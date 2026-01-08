// src/app/api/orders/route.ts - NIEUWE FILE
// API endpoints for Orders management

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ===========================================
// GET - List all orders
// ===========================================

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || await getDefaultUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const shopName = searchParams.get('shop');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build where clause
    const where: any = { userId };
    
    if (status) {
      where.status = status;
    }
    
    if (shopName) {
      where.shopName = { contains: shopName, mode: 'insensitive' };
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where })
    ]);
    
    // Get status summary
    const statusSummary = await prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true }
    });
    
    return NextResponse.json({
      success: true,
      data: orders,
      meta: {
        total,
        limit,
        offset,
        statusSummary: statusSummary.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ===========================================
// POST - Create or update order
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    const userId = request.headers.get('x-user-id') || await getDefaultUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    switch (action) {
      case 'create':
        return await createOrder(body, userId);
        
      case 'update':
        return await updateOrder(body, userId);
        
      case 'update_status':
        return await updateOrderStatus(body, userId);
        
      case 'mark_paid':
        return await markOrderPaid(body.orderId, userId);
        
      case 'link_package':
        return await linkOrderToPackage(body.orderId, body.packageId, userId);
        
      case 'delete':
        return await deleteOrder(body.orderId, userId);
        
      case 'check_reminders':
        return await checkReminders(userId);
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function getDefaultUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst();
  return user?.id || null;
}

async function createOrder(body: any, userId: string) {
  const order = await prisma.order.create({
    data: {
      userId,
      shopName: body.shopName,
      orderNumber: body.orderNumber,
      productName: body.productName,
      status: body.status || 'ORDERED',
      amount: body.amount,
      currency: body.currency || 'EUR',
      isPaid: body.isPaid || false,
      orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
      notes: body.notes
    }
  });
  
  return NextResponse.json({ success: true, data: order });
}

async function updateOrder(body: any, userId: string) {
  const { orderId, ...updateData } = body;
  
  // Convert date strings to Date objects
  if (updateData.orderDate) updateData.orderDate = new Date(updateData.orderDate);
  if (updateData.expectedDate) updateData.expectedDate = new Date(updateData.expectedDate);
  if (updateData.shippedDate) updateData.shippedDate = new Date(updateData.shippedDate);
  if (updateData.deliveredDate) updateData.deliveredDate = new Date(updateData.deliveredDate);
  
  delete updateData.action;
  
  const order = await prisma.order.update({
    where: { id: orderId, userId },
    data: updateData
  });
  
  return NextResponse.json({ success: true, data: order });
}

async function updateOrderStatus(body: any, userId: string) {
  const { orderId, status } = body;
  
  const updateData: any = { status };
  
  // Auto-set dates based on status
  if (status === 'SHIPPED') {
    updateData.shippedDate = new Date();
  } else if (status === 'DELIVERED') {
    updateData.deliveredDate = new Date();
  } else if (status === 'PAID') {
    updateData.isPaid = true;
  }
  
  const order = await prisma.order.update({
    where: { id: orderId, userId },
    data: updateData
  });
  
  return NextResponse.json({ success: true, data: order });
}

async function markOrderPaid(orderId: string, userId: string) {
  const order = await prisma.order.update({
    where: { id: orderId, userId },
    data: { 
      isPaid: true,
      status: 'PAID'
    }
  });
  
  return NextResponse.json({ success: true, data: order });
}

async function linkOrderToPackage(orderId: string, packageId: string, userId: string) {
  const order = await prisma.order.update({
    where: { id: orderId, userId },
    data: { 
      packageId,
      status: 'SHIPPED',
      shippedDate: new Date()
    }
  });
  
  return NextResponse.json({ success: true, data: order });
}

async function deleteOrder(orderId: string, userId: string) {
  await prisma.order.delete({
    where: { id: orderId, userId }
  });
  
  return NextResponse.json({ success: true });
}

async function checkReminders(userId: string) {
  // Find orders that need reminders:
  // - Status is ORDERED or AWAITING_PAYMENT
  // - Older than 7 days
  // - No reminder sent yet
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const ordersNeedingReminder = await prisma.order.findMany({
    where: {
      userId,
      status: { in: ['ORDERED', 'AWAITING_PAYMENT'] },
      orderDate: { lt: sevenDaysAgo },
      reminderSent: false
    }
  });
  
  // Mark reminders as sent and return list
  if (ordersNeedingReminder.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: { in: ordersNeedingReminder.map(o => o.id) }
      },
      data: { reminderSent: true }
    });
  }
  
  return NextResponse.json({
    success: true,
    data: {
      count: ordersNeedingReminder.length,
      orders: ordersNeedingReminder.map(o => ({
        id: o.id,
        shopName: o.shopName,
        orderNumber: o.orderNumber,
        productName: o.productName,
        status: o.status,
        orderDate: o.orderDate,
        daysSinceOrder: Math.floor((Date.now() - o.orderDate.getTime()) / (1000 * 60 * 60 * 24))
      }))
    }
  });
}
