import { Shell } from "@/components/shell";
import { LockScreen } from "@/components/lock-screen";
import { PushKeeper } from "@/components/push-keeper";
import { db } from "@/db";
import { getSosInfo } from "@/server/sos";
import { getIslandState, getUnreadCount } from "@/lib/data";
import { getLock, isLocked } from "@/lib/lock";
import { hiddenFor } from "@/lib/privacy";
import { getMe } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (await isLocked(me)) {
    const sos = me.role === "owner" ? await getSosInfo(db, me.spaceId) : null;
    return (
      <LockScreen
        name={me.name}
        sos={sos ? { numbers: sos.numbers, phoneReady: sos.phoneReady, camera: sos.camera, active: sos.active ? { id: sos.active.id, token: sos.active.token } : null } : null}
      />
    );
  }
  const [unread, island, hidden, lock] = await Promise.all([getUnreadCount(me.spaceId), getIslandState(me.spaceId, me.id), hiddenFor(me), getLock(me.id)]);
  // The viewer's island only shows what she shares.
  const safeIsland = {
    ...island,
    ...(hidden.has("tasks") ? { next: null, todayOpen: 0, todayDone: 0, tasks: [] } : {}),
    ...(hidden.has("stuff") ? { expiring: 0, low: 0 } : {}),
    ...(hidden.has("study") ? { exam: null } : {}),
    ...(hidden.has("cozy") ? { countdown: null } : {}),
  };
  return (
    <Shell
      meId={me.id}
      role={me.role}
      name={me.name}
      ownerName={me.ownerName}
      unread={unread}
      island={safeIsland}
      hidden={[...hidden]}
      lockMinutes={lock?.lockMinutes ?? 0}
    >
      <PushKeeper publicKey={process.env.VAPID_PUBLIC_KEY || null} />
      {children}
    </Shell>
  );
}
