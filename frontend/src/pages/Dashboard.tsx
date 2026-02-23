import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  AlertTriangle, 
  Heart, 
  Activity, 
  Thermometer,
  Clock,
  TrendingUp,
  Bell
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface DashboardStats {
  totalPatients: number;
  activeAlerts: number;
  criticalPatients: number;
  onlineUsers: number;
}

interface VitalTrend {
  time: string;
  heartRate: number;
  temperature: number;
  bloodPressure: number;
}

interface RecentAlert {
  id: number;
  patientName: string;
  alertType: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    activeAlerts: 0,
    criticalPatients: 0,
    onlineUsers: 0
  });
  const [vitalTrends, setVitalTrends] = useState<VitalTrend[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    // Setup socket listeners
    if (socket) {
      socket.on('new_alert', handleNewAlert);
      socket.on('alert_count', handleAlertCount);
      socket.on('vital_signs_updated', handleVitalSignsUpdate);
      
      return () => {
        socket.off('new_alert');
        socket.off('alert_count');
        socket.off('vital_signs_updated');
      };
    }
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, trendsResponse, alertsResponse] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/dashboard/vital-trends'),
        axios.get('/api/alerts/recent')
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      if (trendsResponse.data.success) {
        setVitalTrends(trendsResponse.data.data);
      }

      if (alertsResponse.data.success) {
        setRecentAlerts(alertsResponse.data.data);
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast.error('대시보드 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewAlert = (alertData: any) => {
    setRecentAlerts(prev => [alertData, ...prev.slice(0, 9)]); // Keep only 10 recent alerts
    setStats(prev => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }));
    
    // Show toast notification
    toast.error(`새 알림: ${alertData.patientName} - ${alertData.message}`, {
      duration: 6000,
      icon: '🚨'
    });
  };

  const handleAlertCount = (data: { count: number }) => {
    setStats(prev => ({ ...prev, activeAlerts: data.count }));
  };

  const handleVitalSignsUpdate = (data: any) => {
    // Update vital trends with new data
    const newTrend = {
      time: format(new Date(), 'HH:mm'),
      heartRate: data.vitalSigns.heartRate || 0,
      temperature: data.vitalSigns.temperature || 0,
      bloodPressure: data.vitalSigns.bloodPressureSystolic || 0
    };
    
    setVitalTrends(prev => [...prev.slice(-11), newTrend]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    link?: string;
  }> = ({ title, value, icon, color, link }) => {
    const content = (
      <div className={`bg-white rounded-lg shadow p-6 ${link ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}`}>
        <div className="flex items-center">
          <div className={`p-3 rounded-full ${color}`}>
            {icon}
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );

    return link ? <Link to={link}>{content}</Link> : content;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            대시보드
          </h1>
          <p className="text-gray-600">
            안녕하세요, {user?.firstName || user?.username}님. HealthWatch Pro에 오신 것을 환영합니다.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? '실시간 연결됨' : '연결 끊김'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="전체 환자"
          value={stats.totalPatients}
          icon={<Users className="h-6 w-6 text-white" />}
          color="bg-blue-500"
          link="/patients"
        />
        <StatCard
          title="활성 알림"
          value={stats.activeAlerts}
          icon={<AlertTriangle className="h-6 w-6 text-white" />}
          color="bg-red-500"
          link="/alerts"
        />
        <StatCard
          title="중환자"
          value={stats.criticalPatients}
          icon={<Heart className="h-6 w-6 text-white" />}
          color="bg-orange-500"
        />
        <StatCard
          title="온라인 사용자"
          value={stats.onlineUsers}
          icon={<Activity className="h-6 w-6 text-white" />}
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vital Signs Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">실시간 생체신호 추이</h2>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitalTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="heartRate" 
                  stroke="#3B82F6" 
                  name="심박수"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#EF4444" 
                  name="체온"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">최근 알림</h2>
            <Bell className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity).split(' ')[1]}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{alert.patientName}</p>
                    <p className="text-sm text-gray-600 truncate">{alert.message}</p>
                    <p className="text-xs text-gray-400 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(new Date(alert.timestamp), 'MM/dd HH:mm')}
                    </p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                    {alert.alertType}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">최근 알림이 없습니다.</p>
            )}
          </div>
          {recentAlerts.length > 0 && (
            <div className="mt-4 text-center">
              <Link 
                to="/alerts" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                모든 알림 보기 →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/patients/new" 
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="font-medium text-gray-900">새 환자 등록</p>
              <p className="text-sm text-gray-500">새로운 환자를 시스템에 등록</p>
            </div>
          </Link>
          
          <Link 
            to="/vital-signs" 
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Thermometer className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="font-medium text-gray-900">생체신호 입력</p>
              <p className="text-sm text-gray-500">환자 생체신호 측정 및 기록</p>
            </div>
          </Link>
          
          <Link 
            to="/analytics" 
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="font-medium text-gray-900">분석 보고서</p>
              <p className="text-sm text-gray-500">환자 데이터 분석 및 리포트</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;