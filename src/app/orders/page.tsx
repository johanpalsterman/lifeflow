'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Order {
  id: string;
  shopName: string;
  orderNumber: string | null;
  productName: string | null;
  status: string;
  amount: number | null;
  currency: string;
  isPaid: boolean;
  orderDate: string;
  expectedDate: string | null;
  shippedDate: string | null;
  deliveredDate: string | null;
  trackingNumber: string | null;
  packageId: string | null;
  notes: string | null;
  reminderSent: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; emoji: string; bgColor: string; textColor: string }> = {
  ORDERED: { label: 'Besteld', emoji: '🛒', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  AWAITING_PAYMENT: { label: 'Wacht op betaling', emoji: '💳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  PAID: { label: 'Betaald', emoji: '✓', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  PROCESSING: { label: 'In behandeling', emoji: '⏳', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  SHIPPED: { label: 'Verzonden', emoji: '🚚', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
  DELIVERED: { label: 'Geleverd', emoji: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  CANCELLED: { label: 'Geannuleerd', emoji: '❌', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  RETURNED: { label: 'Geretourneerd', emoji: '↩️', bgColor: 'bg-orange-100', textColor: 'text-orange-800' }
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setOrders(data.data || []);
        setStatusSummary(data.meta?.statusSummary || {});
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
    setLoading(false);
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          orderId,
          status: newStatus
        })
      });
      
      if (res.ok) {
        loadOrders();
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function getDaysInfo(expectedDate: string | null, orderDate: string): { label: string; color: string } | null {
    if (expectedDate) {
      const now = new Date();
      const expected = new Date(expectedDate);
      const diffDays = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { label: `${Math.abs(diffDays)} dagen te laat`, color: 'text-red-600' };
      } else if (diffDays === 0) {
        return { label: 'Vandaag verwacht', color: 'text-green-600' };
      } else if (diffDays === 1) {
        return { label: 'Morgen verwacht', color: 'text-green-600' };
      } else if (diffDays <= 3) {
        return { label: `Over ${diffDays} dagen`, color: 'text-blue-600' };
      } else {
        return { label: `Over ${diffDays} dagen`, color: 'text-gray-600' };
      }
    }
    
    // No expected date - show days since order
    const now = new Date();
    const ordered = new Date(orderDate);
    const daysSince = Math.floor((now.getTime() - ordered.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince > 14) {
      return { label: `${daysSince} dagen geleden besteld`, color: 'text-red-600' };
    } else if (daysSince > 7) {
      return { label: `${daysSince} dagen geleden besteld`, color: 'text-yellow-600' };
    }
    
    return null;
  }

  // Separate active and completed orders
  const activeOrders = orders.filter(o => 
    !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status)
  );
  const completedOrders = orders.filter(o => 
    ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status)
  );

  const totalActive = Object.entries(statusSummary)
    .filter(([status]) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(status))
    .reduce((sum, [_, count]) => sum + count, 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🛒 Bestellingen
          </h1>
          <p className="text-gray-500">
            {totalActive} actieve bestellingen
          </p>
        </div>
        
        <button
          onClick={loadOrders}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          🔄 Vernieuwen
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Alle ({orders.length})
        </button>
        
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = statusSummary[status] || 0;
          if (count === 0 && statusFilter !== status) return null;
          
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? `${config.bgColor} ${config.textColor} ring-2 ring-offset-1`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {config.emoji} {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            ⏳ Actieve bestellingen ({activeOrders.length})
          </h2>
          
          <div className="space-y-4">
            {activeOrders.map(order => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.ORDERED;
              const daysInfo = getDaysInfo(order.expectedDate, order.orderDate);
              
              return (
                <div 
                  key={order.id}
                  className="bg-white rounded-lg shadow p-5 border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    {/* Left: Order Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold">{order.shopName}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                          {config.emoji} {config.label}
                        </span>
                        {daysInfo && (
                          <span className={`text-sm font-medium ${daysInfo.color}`}>
                            {daysInfo.label}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-2">
                        {order.productName || 'Geen productnaam'}
                        {order.orderNumber && (
                          <span className="text-gray-400 ml-2">#{order.orderNumber}</span>
                        )}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>📅 Besteld: {formatDate(order.orderDate)}</span>
                        
                        {order.amount && (
                          <span>
                            💰 {order.currency} {order.amount.toFixed(2)}
                            {order.isPaid && <span className="text-green-600 ml-1">✓ betaald</span>}
                          </span>
                        )}
                        
                        {order.expectedDate && (
                          <span>📦 Verwacht: {formatDate(order.expectedDate)}</span>
                        )}
                        
                        {order.trackingNumber && (
                          <span>🔍 {order.trackingNumber}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Right: Actions */}
                    <div className="flex gap-2 ml-4">
                      {order.status === 'ORDERED' && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'SHIPPED')}
                            className="px-3 py-1 text-sm bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200"
                          >
                            🚚 Verzonden
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            ❌ Annuleren
                          </button>
                        </>
                      )}
                      {order.status === 'AWAITING_PAYMENT' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'PAID')}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          ✓ Betaald
                        </button>
                      )}
                      {order.status === 'SHIPPED' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          ✅ Ontvangen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Orders */}
      {completedOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-600 flex items-center gap-2">
            ✅ Afgeronde bestellingen ({completedOrders.length})
          </h2>
          
          <div className="space-y-2">
            {completedOrders.slice(0, 10).map(order => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.DELIVERED;
              
              return (
                <div 
                  key={order.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{order.shopName}</span>
                      <span className="text-gray-500">
                        {order.productName || order.orderNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">
                        {formatDate(order.deliveredDate || order.orderDate)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.textColor}`}>
                        {config.emoji} {config.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-lg">Geen bestellingen gevonden</p>
          <p className="text-sm">Bestellingen worden automatisch herkend uit je emails</p>
          <Link 
            href="/settings"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Naar Instellingen
          </Link>
        </div>
      )}
    </div>
  );
}
