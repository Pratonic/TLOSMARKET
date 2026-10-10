import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kind } = await req.json();
  if (kind !== 'GOOD' && kind !== 'BAD') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  try {
    const existingCount = await prisma.eventDef.count({ where: { kind } });
    const code = kind === 'GOOD' ? `G${existingCount + 1}` : `B${existingCount + 1}`;
    
    // Get active companies to create default bindings
    const companies = await prisma.company.findMany({ where: { active: true } });

    const newEvent = await prisma.eventDef.create({
      data: {
        code,
        kind,
        orderIndex: existingCount + 1,
        title: `New ${kind} Event ${existingCount + 1}`,
        questionText: 'Enter question description here...',
        eventCompanies: {
          create: companies.map(c => ({
            companyId: c.id,
            aggressiveMove: 0.1,
            moderateMove: 0.05,
            holdDrop: 0.1
          }))
        }
      }
    });

    return NextResponse.json({ success: true, event: newEvent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
