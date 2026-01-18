import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Calendar, MapPin, Users, Clock, TrendingUp, AlertCircle, Settings, Activity, Wifi, WifiOff, Menu, X, Bell, Download, RefreshCw, Zap, Database, AlertTriangle } from 'lucide-react';

// API Configuration
const API_CONFIG = {
  baseURL: 'https://api.uidai.gov.in/v1', // Replace with actual UIDAI API base URL
  apiKey: import.meta.env.VITE_UIDAI_API_KEY, // ⚠️ REPLACE WITH YOUR ACTUAL API KEY
  endpoints: {
    centers: '/centers',
    demand: '/demand/historical',
    predictions: '/demand/predictions',
    liveUpdates: '/updates/live',
    stats: '/stats/today'
  },
  websocketURL: 'wss://api.uidai.gov.in/ws' // Replace with actual WebSocket URL
};

// API Service Class
class UidaiAPIService {
  constructor(config) {
    this.config = config;
  }

  async fetchWithAuth(endpoint, options = {}) {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'x-api-key': this.config.apiKey,
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Fetch Error:', error);
      throw error;
    }
  }

  async getCenters() {
    return await this.fetchWithAuth(this.config.endpoints.centers);
  }

  async getHistoricalDemand(days = 90) {
    return await this.fetchWithAuth(`${this.config.endpoints.demand}?days=${days}`);
  }

  async getPredictions(days = 7) {
    return await this.fetchWithAuth(`${this.config.endpoints.predictions}?days=${days}`);
  }

  async getTodayStats() {
    return await this.fetchWithAuth(this.config.endpoints.stats);
  }

  async getLiveUpdates(limit = 10) {
    return await this.fetchWithAuth(`${this.config.endpoints.liveUpdates}?limit=${limit}`);
  }
}

// WebSocket Integration
class AadhaarWebSocket {
  constructor(url, apiKey, onMessage, onStatusChange) {
    this.url = `${url}?token=${apiKey}`;
    this.ws = null;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        this.reconnectAttempts = 0;
        this.onStatusChange(true);
        
        this.send({
          type: 'subscribe',
          channels: ['center_updates', 'demand_updates', 'alerts']
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket Disconnected');
        this.onStatusChange(false);
        this.reconnect();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.onStatusChange(false);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 3000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Fallback synthetic data for demo/development
const generateFallbackData = () => {
  const data = [];
  const baseDate = new Date('2025-01-01');
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let baseDemand = isWeekend ? 50 : 150;
    baseDemand += i * 0.5;
    const demand = Math.floor(baseDemand + Math.random() * 30 - 15);
    
    data.push({
      date: date.toISOString().split('T')[0],
      demand: Math.max(20, demand),
      demographic: Math.floor(demand * 0.4),
      biometric: Math.floor(demand * 0.3),
      mobile: Math.floor(demand * 0.2),
      address: Math.floor(demand * 0.1)
    });
  }
  
  return data;
};

const generateFallbackCenters = () => {
  const centers = [
    { id: 1, name: 'Ranchi Central Hub', capacity: 200, location: 'Ranchi', staff: 8 },
    { id: 2, name: 'Jamshedpur Tech Center', capacity: 180, location: 'Jamshedpur', staff: 7 },
    { id: 3, name: 'Patna Main Office', capacity: 220, location: 'Patna', staff: 9 },
    { id: 4, name: 'Kolkata Metro Center', capacity: 250, location: 'Kolkata', staff: 10 },
    { id: 5, name: 'Bhubaneswar Smart Hub', capacity: 190, location: 'Bhubaneswar', staff: 8 }
  ];
  
  return centers.map(center => ({
    ...center,
    currentLoad: Math.floor(Math.random() * center.capacity * 0.8),
    avgWaitTime: Math.floor(Math.random() * 45 + 10),
    prediction: Math.floor(center.capacity * (0.6 + Math.random() * 0.3)),
    activeCounters: Math.floor(center.staff * 0.8),
    queueLength: Math.floor(Math.random() * 50 + 5),
    satisfaction: Math.floor(Math.random() * 20 + 80)
  }));
};

const predictDemand = (historicalData, days = 7) => {
  const predictions = [];
  const lastDate = new Date(historicalData[historicalData.length - 1].date);
  
  const recentData = historicalData.slice(-14);
  const avgRecent = recentData.reduce((sum, d) => sum + d.demand, 0) / recentData.length;
  const olderData = historicalData.slice(-28, -14);
  const avgOlder = olderData.reduce((sum, d) => sum + d.demand, 0) / olderData.length;
  const trend = (avgRecent - avgOlder) / 14;
  
  for (let i = 1; i <= days; i++) {
    const predDate = new Date(lastDate);
    predDate.setDate(predDate.getDate() + i);
    const dayOfWeek = predDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let prediction = avgRecent + (trend * i);
    prediction = isWeekend ? prediction * 0.4 : prediction;
    
    predictions.push({
      date: predDate.toISOString().split('T')[0],
      predicted: Math.floor(Math.max(20, prediction)),
      confidence: 85 + Math.random() * 10,
      isWeekend
    });
  }
  
  return predictions;
};

const AadhaarDemandSystem = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [centers, setCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useApiData, setUseApiData] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalDemand: 847,
    avgWaitTime: 23,
    activeCenters: 5,
    utilization: 78
  });
  const [realtimeData, setRealtimeData] = useState([]);
  const updateIntervalRef = useRef(null);
  const wsRef = useRef(null);
  const apiServiceRef = useRef(null);

  useEffect(() => {
    initializeSystem();

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [useApiData]);

  const initializeSystem = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (useApiData && API_CONFIG.apiKey !== 'YOUR_API_KEY_HERE') {
        // Initialize API Service
        apiServiceRef.current = new UidaiAPIService(API_CONFIG);
        
        // Fetch data from API
        await fetchApiData();
        
        // Initialize WebSocket
        wsRef.current = new AadhaarWebSocket(
          API_CONFIG.websocketURL,
          API_CONFIG.apiKey,
          handleWebSocketMessage,
          setIsLiveConnected
        );
        wsRef.current.connect();
      } else {
        // Use fallback data
        const fallbackData = generateFallbackData();
        setHistoricalData(fallbackData);
        setPredictions(predictDemand(fallbackData));
        setCenters(generateFallbackCenters());
        initializeRealtimeData();
        startRealtimeUpdates();
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Initialization error:', err);
      setError('Failed to load data. Using fallback data.');
      // Fallback to synthetic data on error
      const fallbackData = generateFallbackData();
      setHistoricalData(fallbackData);
      setPredictions(predictDemand(fallbackData));
      setCenters(generateFallbackCenters());
      initializeRealtimeData();
      startRealtimeUpdates();
      setIsLoading(false);
    }
  };

  const fetchApiData = async () => {
    try {
      const [centersData, histData, predsData, statsData] = await Promise.all([
        apiServiceRef.current.getCenters(),
        apiServiceRef.current.getHistoricalDemand(),
        apiServiceRef.current.getPredictions(),
        apiServiceRef.current.getTodayStats()
      ]);

      setCenters(centersData.centers || centersData);
      setHistoricalData(histData.data || histData);
      setPredictions(predsData.predictions || predsData);
      setTodayStats(statsData.stats || statsData);
      
      initializeRealtimeData();
    } catch (err) {
      throw new Error('API fetch failed: ' + err.message);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'center_update':
        updateCenterFromWebSocket(data.payload);
        break;
      case 'demand_update':
        updateDemandFromWebSocket(data.payload);
        break;
      case 'alert':
        addAlert(data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const updateCenterFromWebSocket = (payload) => {
    setCenters(prev => prev.map(center => 
      center.id === payload.centerId ? { ...center, ...payload.data } : center
    ));
  };

  const updateDemandFromWebSocket = (payload) => {
    setTodayStats(prev => ({ ...prev, ...payload }));
  };

  const addAlert = (payload) => {
    const newUpdate = {
      id: Date.now(),
      type: payload.severity || 'info',
      icon: payload.severity === 'warning' ? '⚠' : 'ℹ',
      message: payload.message,
      timestamp: new Date().toLocaleTimeString()
    };
    setLiveUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);
  };

  const initializeRealtimeData = () => {
    const now = new Date();
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        requests: Math.floor(Math.random() * 30 + 40),
        completed: Math.floor(Math.random() * 25 + 35)
      });
    }
    setRealtimeData(data);
  };

  const startRealtimeUpdates = () => {
    updateIntervalRef.current = setInterval(() => {
      updateCenters();
      updateStats();
      updateRealtimeChart();
      addLiveUpdate();
    }, 3000);
  };

  const updateCenters = () => {
    setCenters(prevCenters => 
      prevCenters.map(center => {
        const loadChange = Math.floor(Math.random() * 10 - 5);
        const waitChange = Math.floor(Math.random() * 6 - 3);
        const queueChange = Math.floor(Math.random() * 6 - 3);
        
        return {
          ...center,
          currentLoad: Math.max(10, Math.min(center.capacity, center.currentLoad + loadChange)),
          avgWaitTime: Math.max(5, Math.min(60, center.avgWaitTime + waitChange)),
          queueLength: Math.max(0, center.queueLength + queueChange),
          lastUpdated: new Date().toLocaleTimeString()
        };
      })
    );
  };

  const updateStats = () => {
    setTodayStats(prev => ({
      totalDemand: Math.max(700, Math.min(1000, prev.totalDemand + Math.floor(Math.random() * 20 - 10))),
      avgWaitTime: Math.max(15, Math.min(35, prev.avgWaitTime + Math.floor(Math.random() * 4 - 2))),
      activeCenters: 5,
      utilization: Math.max(65, Math.min(90, prev.utilization + Math.floor(Math.random() * 6 - 3)))
    }));
  };

  const updateRealtimeChart = () => {
    setRealtimeData(prev => {
      const newData = [...prev.slice(1)];
      const now = new Date();
      newData.push({
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        requests: Math.floor(Math.random() * 30 + 40),
        completed: Math.floor(Math.random() * 25 + 35)
      });
      return newData;
    });
  };

  const addLiveUpdate = () => {
    const updateTypes = [
      { type: 'success', icon: '✓', message: 'Request completed at Ranchi Central Hub' },
      { type: 'info', icon: 'ℹ', message: 'New appointment scheduled at Jamshedpur Tech Center' },
      { type: 'warning', icon: '⚠', message: 'High load detected at Patna Main Office' },
      { type: 'success', icon: '✓', message: 'Biometric update completed at Kolkata Metro Center' },
      { type: 'info', icon: 'ℹ', message: 'Staff shift change at Bhubaneswar Smart Hub' }
    ];
    
    const randomUpdate = updateTypes[Math.floor(Math.random() * updateTypes.length)];
    const newUpdate = {
      id: Date.now(),
      ...randomUpdate,
      timestamp: new Date().toLocaleTimeString()
    };

    setLiveUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);
  };

  const toggleLiveConnection = () => {
    if (isLiveConnected) {
      clearInterval(updateIntervalRef.current);
      setIsLiveConnected(false);
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    } else {
      startRealtimeUpdates();
      setIsLiveConnected(true);
      if (wsRef.current) {
        wsRef.current.connect();
      }
    }
  };

  const toggleDataSource = () => {
    setUseApiData(!useApiData);
  };

  const updateTypeData = [
    { name: 'Demographic', value: 40, color: '#6366f1' },
    { name: 'Biometric', value: 30, color: '#10b981' },
    { name: 'Mobile/Email', value: 20, color: '#f59e0b' },
    { name: 'Address', value: 10, color: '#ef4444' }
  ];

  const optimizationRecommendations = [
    { 
      center: 'Patna Main Office', 
      action: 'Add 2 staff members', 
      impact: 'Reduce wait time by 15 min',
      priority: 'high'
    },
    { 
      center: 'Kolkata Metro Center', 
      action: 'Extend hours 9 AM - 7 PM', 
      impact: 'Handle 30% more requests',
      priority: 'medium'
    },
    { 
      center: 'Ranchi Central Hub', 
      action: 'Enable online appointments', 
      impact: 'Reduce walk-in congestion',
      priority: 'high'
    }
  ];

  const combinedChartData = historicalData.slice(-30).map(d => ({
    date: d.date.split('-').slice(1).join('/'),
    actual: d.demand
  })).concat(predictions.map(p => ({
    date: p.date.split('-').slice(1).join('/'),
    predicted: p.predicted
  })));

  const StatCard = ({ icon, title, value, change, positive, isLive, gradient }) => (
    <div className={`bg-gradient-to-br ${gradient} text-white p-6 rounded-2xl shadow-xl relative overflow-hidden transform hover:scale-105 transition-all duration-300`}>
      {isLive && (
        <div className="absolute top-3 right-3">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block shadow-lg"></span>
        </div>
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
            {icon}
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${positive ? 'bg-white bg-opacity-20' : 'bg-red-500 bg-opacity-30'}`}>
            {change}
          </span>
        </div>
        <h3 className="text-sm font-medium opacity-90 mb-1">{title}</h3>
        <p className="text-3xl font-bold">{value}</p>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
    </div>
  );

  const DashboardView = () => (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-800">Notice</h4>
            <p className="text-sm text-yellow-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-6 rounded-2xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {isLiveConnected ? (
              <>
                <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
                  <Activity className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Live Monitoring Active</h3>
                  <p className="text-indigo-100 text-sm mt-1">
                    {useApiData ? 'Real-time data from UIDAI API' : 'Demo mode with simulated data'}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    {useApiData ? 'API Connected' : 'Demo Mode'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
                  <WifiOff className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Updates Paused</h3>
                  <p className="text-indigo-100 text-sm mt-1">Click resume to reconnect</p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleDataSource}
              className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-xl hover:bg-opacity-30 transition-all font-semibold text-sm flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              {useApiData ? 'API Mode' : 'Demo Mode'}
            </button>
            <button
              onClick={toggleLiveConnection}
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl hover:bg-opacity-90 transition-all font-bold shadow-lg flex items-center gap-2"
            >
              {isLiveConnected ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          icon={<Users className="w-7 h-7" />}
          title="Today's Demand"
          value={todayStats.totalDemand}
          change="+12%"
          positive={true}
          isLive={isLiveConnected}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard 
          icon={<Clock className="w-7 h-7" />}
          title="Avg Wait Time"
          value={`${todayStats.avgWaitTime} min`}
          change="-8%"
          positive={true}
          isLive={isLiveConnected}
          gradient="from-green-500 to-green-600"
        />
        <StatCard 
          icon={<MapPin className="w-7 h-7" />}
          title="Active Centers"
          value={todayStats.activeCenters}
          change="100%"
          positive={true}
          isLive={isLiveConnected}
          gradient="from-purple-500 to-purple-600"
        />
        <StatCard 
          icon={<TrendingUp className="w-7 h-7" />}
          title="Utilization"
          value={`${todayStats.utilization}%`}
          change="+5%"
          positive={true}
          isLive={isLiveConnected}
          gradient="from-pink-500 to-pink-600"
        />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-800">Real-time Request Flow</h3>
            <p className="text-gray-500 text-sm mt-1">Live data from the last 30 minutes</p>
          </div>
          {isLiveConnected && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-semibold text-green-700">Live Streaming</span>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={realtimeData}>
            <defs>
              <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: 'none', 
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
              }}
            />
            <Area type="monotone" dataKey="requests" stroke="#6366f1" fillOpacity={1} fill="url(#colorRequests)" strokeWidth={3} name="New Requests" />
            <Area type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={3} name="Completed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-800">Live Center Status</h3>
              <p className="text-gray-500 text-sm mt-1">Real-time monitoring across all locations</p>
            </div>
            {isLiveConnected && (
              <span className="text-xs text-gray-400 hidden md:block">Updates every 3s</span>
            )}
          </div>
          <div className="space-y-4">
            {centers.map(center => {
              const utilization = (center.currentLoad / center.capacity * 100).toFixed(0);
              const isOverloaded = utilization > 80;
              const isModerate = utilization > 60 && utilization <= 80;
              
              return (
                <div key={center.id} className="group border-2 border-gray-100 rounded-xl p-4 md:p-5 hover:shadow-lg transition-all duration-300 hover:border-indigo-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${isOverloaded ? 'bg-red-500' : isModerate ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></div>
                        <h4 className="font-bold text-lg text-gray-800">{center.name}</h4>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {center.location}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <div className={`text-3xl font-bold ${isOverloaded ? 'text-red-600' : isModerate ? 'text-yellow-600' : 'text-green-600'}`}>
                        {center.currentLoad}<span className="text-lg text-gray-400">/{center.capacity}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{center.lastUpdated}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                      <span className="text-gray-500 block mb-1">Queue</span>
                      <span className="font-bold text-lg text-gray-800">{center.queueLength}</span>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                      <span className="text-gray-500 block mb-1">Wait Time</span>
                      <span className="font-bold text-lg text-gray-800">{center.avgWaitTime}m</span>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                      <span className="text-gray-500 block mb-1">Counters</span>
                      <span className="font-bold text-lg text-gray-800">{center.activeCounters}/{center.staff}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">Utilization</span>
                      <span className={`font-bold ${isOverloaded ? 'text-red-600' : isModerate ? 'text-yellow-600' : 'text-green-600'}`}>
                        {utilization}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          isOverloaded ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                          isModerate ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 
                          'bg-gradient-to-r from-green-500 to-green-600'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Live Activity</h3>
              <p className="text-sm text-gray-500">Recent updates</p>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto" style={{scrollbarWidth: 'thin'}}>
            {liveUpdates.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                Waiting for updates...
              </p>
            )}
            {liveUpdates.map(update => (
              <div 
                key={update.id}
                className={`p-4 rounded-xl border-l-4 transition-all duration-300 ${
                  update.type === 'success' ? 'border-green-500 bg-green-50 hover:bg-green-100' :
                  update.type === 'warning' ? 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100' :
                  'border-blue-500 bg-blue-50 hover:bg-blue-100'
                }`}
                style={{
                  animation: 'slideIn 0.3s ease-out'
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{update.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 break-words">{update.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{update.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Demand Forecast</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={combinedChartData}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="actual" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActual)" name="Historical" />
              <Area type="monotone" dataKey="predicted" stroke="#10b981" fillOpacity={1} fill="url(#colorPredicted)" name="Predicted" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Update Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={updateTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {updateTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const PredictionView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
        <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">7-Day Demand Prediction</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Day</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Predicted</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Confidence</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {predictions.map((pred, idx) => {
                const date = new Date(pred.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                return (
                  <tr key={idx} className={`${pred.isWeekend ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{pred.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{dayName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-lg text-indigo-600">{pred.predicted}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold text-sm">
                        {pred.confidence.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {pred.predicted > 150 ? (
                        <span className="text-red-600 font-medium">⚠ Add staff</span>
                      ) : (
                        <span className="text-green-600 font-medium">✓ Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Peak Hours</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { hour: '9-10', demand: 45 },
              { hour: '10-11', demand: 78 },
              { hour: '11-12', demand: 92 },
              { hour: '12-1', demand: 65 },
              { hour: '1-2', demand: 42 },
              { hour: '2-3', demand: 88 },
              { hour: '3-4', demand: 95 },
              { hour: '4-5', demand: 71 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="demand" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6">ML Performance</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">Accuracy</span>
                <span className="text-sm font-bold text-green-600">87.3%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full" style={{ width: '87.3%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">MAPE</span>
                <span className="text-sm font-bold text-blue-600">8.4%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full" style={{ width: '91.6%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">R² Score</span>
                <span className="text-sm font-bold text-purple-600">0.92</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const OptimizationView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6">AI Recommendations</h3>
        <div className="space-y-4">
          {optimizationRecommendations.map((rec, idx) => (
            <div key={idx} className={`p-5 border-l-4 rounded-xl ${
              rec.priority === 'high' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
            }`}>
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-6 h-6" />
                    <h4 className="font-bold text-lg">{rec.center}</h4>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      rec.priority === 'high' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm mb-2"><strong>Action:</strong> {rec.action}</p>
                  <p className="text-sm text-gray-600"><strong>Impact:</strong> {rec.impact}</p>
                </div>
                <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-bold">
                  Implement
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden md:block bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">UIDAI Aadhaar System</h1>
                <p className="text-blue-100 text-sm mt-1">AI-Powered Demand Prediction & Optimization</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLiveConnected ? (
                <Wifi className="w-6 h-6 text-green-300 animate-pulse" />
              ) : (
                <WifiOff className="w-6 h-6 text-red-300" />
              )}
              <button 
                className="md:hidden bg-white bg-opacity-20 p-2 rounded-lg"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <nav className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block bg-white rounded-2xl shadow-xl mb-6 p-2`}>
          <div className="flex flex-col md:flex-row gap-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-semibold ${
                activeTab === 'dashboard' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('prediction'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-semibold ${
                activeTab === 'prediction' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-5 h-5" />
              Predictions
            </button>
            <button
              onClick={() => { setActiveTab('optimization'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-semibold ${
                activeTab === 'optimization' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-5 h-5" />
              Optimization
            </button>
          </div>
        </nav>

        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'prediction' && <PredictionView />}
        {activeTab === 'optimization' && <OptimizationView />}
      </div>

      <footer className="bg-white border-t mt-8 p-6 text-center">
        <p className="text-gray-600 font-medium">UIDAI Hackathon 2026 | ML Analytics + Real-time WebSocket + API Integration</p>
        <p className="text-sm text-gray-500 mt-2">Ranchi | Jamshedpur | Patna | Kolkata | Bhubaneswar</p>
      </footer>
    </div>
  );
};

export default AadhaarDemandSystem;