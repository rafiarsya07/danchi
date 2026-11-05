import { InstallApp } from "@/components/install-app";
import { ActionForm } from "@/components/action-form";
import { Label, SubmitButton } from "@/components/ui";
import { setMyName } from "@/app/(app)/care-actions";
import { db } from "@/db";
import { getNames } from "@/server/names";
import type { Metadata } from "next";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { MascotBadge } from "@/components/mascot";
import { IslandToggle, NotifyForm, PushSetup } from "@/components/push-setup";
import { PageTitle } from "@/components/ui";
import { ThemePick } from "@/components/theme-pick";
import {
  Devices,
  HomeCardsForm,
  PinForms,
  PrivacyForm,
  QuietForm,
  Visits,
} from "@/components/settings-care";
import { getLock } from "@/lib/lock";
import { getSessions, getVisits } from "@/lib/data3";
import { logout } from "@/app/login/actions";
import { getSettings } from "@/lib/data";
import { getMe } from "@/lib/session";
import { AI_DAILY_LIMIT, aiConfigured } from "@/server/ai";
import { brainLabel } from "@/server/llm";
import { mailConfigured } from "@/server/mail";

export const metadata: Metadata = { title: "Settings" };

function Card({
  title,
  icon,
  children,
  id,
  tone = "bg-white",
}: {
  title: string;
  icon: Parameters<typeof CuteIcon>[0]["name"];
  children: React.ReactNode;
  id?: string;
  tone?: string;
}) {
  return (
    <section
      id={id}
      className={`sticker flex scroll-mt-20 flex-col gap-3 rounded-[26px] ${tone} p-4`}
    >
      <h2 className="font-display flex items-center gap-2 text-xl font-bold">
        <CuteIcon name={icon} size={32} /> {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const me = await getMe();
  const [s, lock, sessions, visits] = await Promise.all([
    getSettings(me.spaceId),
    getLock(me.id),
    getSessions(me.id),
    getVisits(me.spaceId, 20),
  ]);
  const isOwner = me.role === "owner";
  const mailReady = mailConfigured();
  const partner = (await getNames(db)).viewer;
  // eslint-disable-next-line react-hooks/purity
  const fresh = Date.now() - me.sessionCreatedAt.getTime() < 10 * 60_000;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageTitle
        title="Settings"
        icon="settings"
        subtitle="Make Danchi yours"
      />

      <Card title="Look" icon="settings">
        <ThemePick />
      </Card>

      {isOwner && (
        <Card title="Home screen" icon="home">
          <HomeCardsForm hidden={s.homeHidden ?? []} />
        </Card>
      )}

      <Card title="Install the app" icon="home">
        <InstallApp variant="settings" />
      </Card>

      <Card title="Notifications" icon="bell">
        <PushSetup
          publicKey={process.env.VAPID_PUBLIC_KEY || null}
          isOwner={isOwner}
          mailReady={mailReady}
        />
        <p className="rounded-2xl bg-cream px-3 py-2 text-[13px] font-bold text-ink-soft">
          Android: tap <b>Turn on notifications</b> and allow. For the best
          experience, install Danchi: Chrome menu ⋮ → <b>Add to Home screen</b>.
        </p>
      </Card>

      <Card title="When should Chichi talk?" icon="clock">
        {!mailReady && (
          <p className="rounded-2xl border-2 border-ink/40 px-3 py-2 text-[13px] font-bold text-ink-soft">
            Email isn&apos;t set up on the server yet, so only phone pings will
            go out.
          </p>
        )}
        <NotifyForm
          digestHour={s.digestHour}
          nudgeHour={s.nudgeHour}
          emailDigest={s.emailDigest}
          emailReminders={s.emailReminders}
          pinnedStatus={s.pinnedStatus}
          readOnly={!isOwner}
        />
      </Card>

      {isOwner && (
        <Card
          title="How Danchi keeps you safe"
          icon="shield"
          tone="bg-mint-soft"
        >
          <ul className="flex flex-col gap-2 text-sm font-bold">
            {[
              [
                "🔑",
                "Only two Google accounts can ever open Danchi. Everyone else is turned away before they get in.",
              ],
              [
                "🏠",
                `Your data lives on ${partner}'s own mini PC, not on some company's server, and travels through an encrypted tunnel.`,
              ],
              [
                "🔐",
                "Every sign in sends you an alert, and you can sign out any device from here.",
              ],
              [
                "🔒",
                "Add a PIN so nobody can peek if your phone is unlocked in someone else's hands.",
              ],
              [
                "🙈",
                `You decide what ${partner} sees. Your cycle and private journal pages are always just yours.`,
              ],
              [
                "👀",
                `You can see every time ${partner} opens Danchi. No secret looking.`,
              ],
              [
                "🗂️",
                "Files are private, with random names, and only open for signed in people. Never type full IC or passport numbers.",
              ],
              [
                "💾",
                "A backup is made every night. And you can download all your data any time below.",
              ],
              [
                "🤝",
                `Honest note: ${partner} runs the server, so technically he could reach the database. These privacy switches are his promise to you, built right into the app.`,
              ],
            ].map(([e, t]) => (
              <li
                key={t}
                className="flex gap-2.5 rounded-2xl border-2 border-ink bg-white px-3 py-2"
              >
                <span className="text-lg leading-tight">{e}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={isOwner ? "Privacy" : "What you can see"}
        icon="lock"
        id="privacy"
      >
        <PrivacyForm s={s} partner={partner} readOnly={!isOwner} />
      </Card>

      <Card
        title={
          isOwner ? `When ${partner} visited` : "Your visits (she sees these)"
        }
        icon="search"
      >
        <Visits visits={visits} partner={partner} viewer={!isOwner} />
      </Card>

      <Card title="PIN lock" icon="lock" id="lock">
        <PinForms
          hasPin={!!lock}
          minutes={lock?.lockMinutes ?? 15}
          fresh={fresh}
        />
      </Card>

      <Card title="Your devices" icon="settings" id="devices">
        <Devices sessions={sessions} currentId={me.sessionId} />
      </Card>

      {isOwner && (
        <Card title="Quiet hours" icon="clock">
          <QuietForm s={s} />
        </Card>
      )}

      {isOwner && (
        <Card title="Your data is yours" icon="papers">
          <p className="text-sm font-bold">
            Download everything in Danchi as one file, any time. Files you
            uploaded stay on the server.
          </p>
          <a
            href="/api/export"
            className="sticker-sm press flex h-11 items-center justify-center self-start rounded-2xl bg-sun px-4 text-sm font-extrabold"
          >
            ⬇ Download my data
          </a>
        </Card>
      )}

      <Card title="Chichi Island" icon="ask">
        <IslandToggle />
      </Card>

      <Card title="Ask Chichi" icon="ask">
        <p className="text-[15px] font-bold">
          {aiConfigured() ? (
            <>
              Chichi&apos;s brain is on ✨ Running on <b>{brainLabel()}</b>, with web search, photo reading and your Danchi. Up to <b>{AI_DAILY_LIMIT}</b>{" "}
              questions a day each.
            </>
          ) : (
            <>Chichi&apos;s brain isn&apos;t plugged in yet. Rafi runs bash deploy/keys.sh on the mini PC.</>
          )}
        </p>
      </Card>

      <Card title="Account" icon="lock">
        <div className="flex items-center gap-3">
          <MascotBadge
            size={52}
            mood={isOwner ? "love" : "happy"}
            bg={isOwner ? "bg-peach-soft" : "bg-sky-soft"}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] font-extrabold">{me.name}</span>
            <span className="text-[13px] font-bold text-ink-soft">
              {isOwner
                ? "Owner, can change everything"
                : `Viewer, looking at ${me.ownerName}'s Danchi`}
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 text-sm font-extrabold"
            >
              <Icon name="logout" size={18} /> Sign out
            </button>
          </form>
        </div>
        <ActionForm action={setMyName} resetOnOk={false} okText="Name saved ✓" className="flex items-end gap-2">
          <Label text="What should Danchi call you?" className="flex-1">
            <input name="name" defaultValue={me.name} maxLength={30} required className="field" />
          </Label>
          <SubmitButton className="h-12 shrink-0 px-4">Save</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
