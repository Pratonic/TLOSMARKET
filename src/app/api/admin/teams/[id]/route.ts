import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    
    // Hard delete team and all associated records
    await prisma.$transaction(async (tx) => {
      await tx.trade.deleteMany({ where: { teamId: id } });
      await tx.choice.deleteMany({ where: { teamId: id } });
      await tx.teamNotes.deleteMany({ where: { teamId: id } });
      
      const snapshots = await tx.snapshot.findMany({ where: { teamId: id }, select: { id: true } });
      const snapshotIds = snapshots.map(s => s.id);
      
      await tx.snapshotHolding.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
      await tx.snapshot.deleteMany({ where: { teamId: id } });
      
      await tx.team.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
