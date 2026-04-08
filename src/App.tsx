import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Groups = Record<string, string[]>;
type WinnerMap = Record<string, string>;
type KnockoutSlot = {
  group?: string;
  team: string;
  slot: string;
};
type KnockoutMatch = {
  id: string;
  teams: [KnockoutSlot, KnockoutSlot];
  winner: string;
};

const initialGroups: Groups = {
  A: ["Meksika", "Güney Afrika", "Güney Kore", "Çekya"],
  B: ["Kanada", "Bosna Hersek", "Katar", "İsviçre"],
  C: ["Brezilya", "Fas", "Haiti", "İskoçya"],
  D: ["Türkiye", "ABD", "Paraguay", "Avustralya"],
  E: ["Almanya", "Curaçao", "Fildişi Sahili", "Ekvador"],
  F: ["Hollanda", "Japonya", "İsveç", "Tunus"],
  G: ["Belçika", "Mısır", "İran", "Yeni Zelanda"],
  H: ["İspanya", "Yeşil Burun Adaları", "Suudi Arabistan", "Uruguay"],
  I: ["Fransa", "Senegal", "Irak", "Norveç"],
  J: ["Arjantin", "Cezayir", "Avusturya", "Ürdün"],
  K: ["Portekiz", "Demokratik Kongo Cumhuriyeti", "Özbekistan", "Kolombiya"],
  L: ["İngiltere", "Hırvatistan", "Gana", "Panama"],
};

const DEFAULT_TITLE = "2026 Dünya Kupası Simülatörü";
const STORAGE_KEY = "world-cup-simulator-2026";

const teamFlags: Record<string, string> = {
  Meksika: "🇲🇽",
  "Güney Afrika": "🇿🇦",
  "Güney Kore": "🇰🇷",
  Çekya: "🇨🇿",
  Kanada: "🇨🇦",
  "Bosna Hersek": "🇧🇦",
  Katar: "🇶🇦",
  İsviçre: "🇨🇭",
  Brezilya: "🇧🇷",
  Fas: "🇲🇦",
  Haiti: "🇭🇹",
  İskoçya: "🏴",
  Türkiye: "🇹🇷",
  ABD: "🇺🇸",
  Paraguay: "🇵🇾",
  Avustralya: "🇦🇺",
  Almanya: "🇩🇪",
  Curaçao: "🇨🇼",
  "Fildişi Sahili": "🇨🇮",
  Ekvador: "🇪🇨",
  Hollanda: "🇳🇱",
  Japonya: "🇯🇵",
  İsveç: "🇸🇪",
  Tunus: "🇹🇳",
  Belçika: "🇧🇪",
  Mısır: "🇪🇬",
  İran: "🇮🇷",
  "Yeni Zelanda": "🇳🇿",
  İspanya: "🇪🇸",
  "Yeşil Burun Adaları": "🇨🇻",
  "Suudi Arabistan": "🇸🇦",
  Uruguay: "🇺🇾",
  Fransa: "🇫🇷",
  Senegal: "🇸🇳",
  Irak: "🇮🇶",
  Norveç: "🇳🇴",
  Arjantin: "🇦🇷",
  Cezayir: "🇩🇿",
  Avusturya: "🇦🇹",
  Ürdün: "🇯🇴",
  Portekiz: "🇵🇹",
  "Demokratik Kongo Cumhuriyeti": "🇨🇩",
  Özbekistan: "🇺🇿",
  Kolombiya: "🇨🇴",
  İngiltere: "🏴",
  Hırvatistan: "🇭🇷",
  Gana: "🇬🇭",
  Panama: "🇵🇦",
};

function getFlag(team: string) {
  if (!team || team === "TBD") {
    return "🏳️";
  }

  return teamFlags[team] || "🏳️";
}

function encodeState(value: unknown) {
  const content = JSON.stringify(value);
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeState(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function sortThirdPlaces(groups: Groups) {
  return Object.entries(groups)
    .map(([group, teams]) => ({
      group,
      team: teams[2],
      rank: 3,
    }))
    .sort((a, b) => a.team.localeCompare(b.team, "tr"))
    .slice(0, 8);
}

function buildRoundOf32(groups: Groups): [KnockoutSlot, KnockoutSlot][] {
  const groupEntries = Object.entries(groups);
  const firsts = groupEntries.map(([group, teams]) => ({ group, team: teams[0], slot: `1${group}` }));
  const seconds = groupEntries.map(([group, teams]) => ({ group, team: teams[1], slot: `2${group}` }));
  const bestThirds = sortThirdPlaces(groups).map((item) => ({ ...item, slot: `3${item.group}` }));

  return [
    [firsts[0], bestThirds[0]],
    [seconds[1], seconds[0]],
    [firsts[2], bestThirds[1]],
    [seconds[3], seconds[2]],
    [firsts[4], bestThirds[2]],
    [seconds[5], seconds[4]],
    [firsts[6], bestThirds[3]],
    [seconds[7], seconds[6]],
    [firsts[8], bestThirds[4]],
    [seconds[9], seconds[8]],
    [firsts[10], bestThirds[5]],
    [seconds[11], seconds[10]],
    [firsts[1], bestThirds[6]],
    [firsts[3], bestThirds[7]],
    [firsts[5], seconds[10]],
    [firsts[7], seconds[11]],
  ];
}

function nextRound(matches: KnockoutMatch[]) {
  const next: [KnockoutSlot, KnockoutSlot][] = [];
  for (let index = 0; index < matches.length; index += 2) {
    next.push([
      { team: matches[index]?.winner || "TBD", slot: "" },
      { team: matches[index + 1]?.winner || "TBD", slot: "" },
    ]);
  }
  return next;
}

function sanitizeWinnerMap(matches: KnockoutMatch[], winners: WinnerMap) {
  const next: WinnerMap = {};

  for (const match of matches) {
    const choices = match.teams.map((slot) => slot.team);
    if (choices.includes(winners[match.id])) {
      next[match.id] = winners[match.id];
    }
  }

  return next;
}

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10v3h3c0 3.8-1.5 6.2-4.7 7.1-.8 1.9-2.1 3.3-3.8 3.8V20h4v2H8.5v-2h4v-3.1c-1.7-.5-3-1.9-3.8-3.8C5.5 12.2 4 9.8 4 6h3V3Zm10 5V5H7v3c0 3.3 2.1 6 5 6s5-2.7 5-6Zm1 0c-.1 1.2-.3 2.4-.8 3.4 1.5-.8 2.4-2.1 2.7-4.4H18Zm-12 0H5.1c.3 2.3 1.2 3.6 2.7 4.4C7.3 10.4 7.1 9.2 7 8Z" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h11l3 3v15H5V3Zm2 2v14h10V7.3L15.2 5H15v4H9V5H7Zm4 0v2h2V5h-2Zm1 14a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6a3 3 0 1 1 .3 1.3L8.9 10.5a3 3 0 0 1 0 3l6.4 3.2A3 3 0 1 1 14.5 18l-6.4-3.2a3 3 0 1 1 0-5.6L14.5 6A3 3 0 0 1 15 6Z" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a7 7 0 1 1-6.4 4.2H3l3.7-3.7L10.5 9H7.8A5 5 0 1 0 12 7V5Z" />
    </svg>
  );
}

function IconGrip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

function TeamRow({
  team,
  index,
}: {
  team: string;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="team-row"
    >
      <div className="team-row__main">
        <span className="team-row__flag" aria-hidden="true">
          {getFlag(team)}
        </span>
        <span
          className={`team-row__grip${isDragging ? " team-row__grip--active" : ""}`}
          aria-hidden="true"
          {...attributes}
          {...listeners}
        >
          <IconGrip />
        </span>
        <span className="team-row__badge">{index + 1}</span>
        <span className="team-row__name">{team}</span>
      </div>
    </div>
  );
}

function MatchCard({
  title,
  teamA,
  teamB,
  winner,
  onPick,
}: {
  title: string;
  teamA: string;
  teamB: string;
  winner: string;
  onPick: (team: string) => void;
}) {
  const isIncomplete = teamA === "TBD" || teamB === "TBD";

  return (
    <article className="panel match-card">
      <header className="match-card__header">
        <h4>{title}</h4>
      </header>
      <div className="match-card__body">
        <button
          type="button"
          disabled={isIncomplete}
          className={winner === teamA ? "match-pick match-pick--active" : "match-pick"}
          onClick={() => onPick(teamA)}
        >
          <span className="match-pick__content">
            <span className="match-pick__flag" aria-hidden="true">
              {getFlag(teamA)}
            </span>
            <span>{teamA}</span>
          </span>
        </button>
        <button
          type="button"
          disabled={isIncomplete}
          className={winner === teamB ? "match-pick match-pick--active" : "match-pick"}
          onClick={() => onPick(teamB)}
        >
          <span className="match-pick__content">
            <span className="match-pick__flag" aria-hidden="true">
              {getFlag(teamB)}
            </span>
            <span>{teamB}</span>
          </span>
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [groups, setGroups] = useState<Groups>(initialGroups);
  const [round32Winners, setRound32Winners] = useState<WinnerMap>({});
  const [round16Winners, setRound16Winners] = useState<WinnerMap>({});
  const [quarterWinners, setQuarterWinners] = useState<WinnerMap>({});
  const [semiWinners, setSemiWinners] = useState<WinnerMap>({});
  const [finalWinner, setFinalWinner] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("state");

    if (shared) {
      try {
        const parsed = decodeState(shared);
        setTitle(parsed.title || DEFAULT_TITLE);
        setGroups(parsed.groups || initialGroups);
        setRound32Winners(parsed.round32Winners || {});
        setRound16Winners(parsed.round16Winners || {});
        setQuarterWinners(parsed.quarterWinners || {});
        setSemiWinners(parsed.semiWinners || {});
        setFinalWinner(parsed.finalWinner || "");
        return;
      } catch {
        // Invalid shared state falls back to local storage.
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setTitle(parsed.title || DEFAULT_TITLE);
      setGroups(parsed.groups || initialGroups);
      setRound32Winners(parsed.round32Winners || {});
      setRound16Winners(parsed.round16Winners || {});
      setQuarterWinners(parsed.quarterWinners || {});
      setSemiWinners(parsed.semiWinners || {});
      setFinalWinner(parsed.finalWinner || "");
    } catch {
      // Ignore malformed local storage and keep defaults.
    }
  }, []);

  const dataToPersist = useMemo(
    () => ({
      title,
      groups,
      round32Winners,
      round16Winners,
      quarterWinners,
      semiWinners,
      finalWinner,
    }),
    [title, groups, round32Winners, round16Winners, quarterWinners, semiWinners, finalWinner]
  );

  const round32Matches = useMemo<KnockoutMatch[]>(() => {
    return buildRoundOf32(groups).map((teams, index) => ({
      id: `r32-${index + 1}`,
      teams,
      winner: round32Winners[`r32-${index + 1}`] || "",
    }));
  }, [groups, round32Winners]);

  const round16Matches = useMemo<KnockoutMatch[]>(() => {
    return nextRound(round32Matches).map((teams, index) => ({
      id: `r16-${index + 1}`,
      teams,
      winner: round16Winners[`r16-${index + 1}`] || "",
    }));
  }, [round32Matches, round16Winners]);

  const quarterMatches = useMemo<KnockoutMatch[]>(() => {
    return nextRound(round16Matches).map((teams, index) => ({
      id: `qf-${index + 1}`,
      teams,
      winner: quarterWinners[`qf-${index + 1}`] || "",
    }));
  }, [quarterWinners, round16Matches]);

  const semiMatches = useMemo<KnockoutMatch[]>(() => {
    return nextRound(quarterMatches).map((teams, index) => ({
      id: `sf-${index + 1}`,
      teams,
      winner: semiWinners[`sf-${index + 1}`] || "",
    }));
  }, [quarterMatches, semiWinners]);

  const finalMatch = useMemo<[KnockoutSlot, KnockoutSlot]>(() => {
    return nextRound(semiMatches)[0] || [
      { team: "TBD", slot: "" },
      { team: "TBD", slot: "" },
    ];
  }, [semiMatches]);

  const finalists = useMemo(
    () => finalMatch.map((slot) => slot.team).filter((team) => team !== "TBD"),
    [finalMatch]
  );

  const championName = useMemo(() => {
    return finalists.includes(finalWinner) ? finalWinner : "";
  }, [finalWinner, finalists]);

  useEffect(() => {
    setRound32Winners((current) => sanitizeWinnerMap(round32Matches, current));
  }, [round32Matches]);

  useEffect(() => {
    setRound16Winners((current) => sanitizeWinnerMap(round16Matches, current));
  }, [round16Matches]);

  useEffect(() => {
    setQuarterWinners((current) => sanitizeWinnerMap(quarterMatches, current));
  }, [quarterMatches]);

  useEffect(() => {
    setSemiWinners((current) => sanitizeWinnerMap(semiMatches, current));
  }, [semiMatches]);

  useEffect(() => {
    if (finalWinner && !finalists.includes(finalWinner)) {
      setFinalWinner("");
    }
  }, [finalWinner, finalists]);

  const moveTeam = (groupKey: string, activeId: string, overId: string) => {
    if (!activeId || !overId || activeId === overId) {
      return;
    }

    setGroups((current) => {
      const teams = [...current[groupKey]];
      const from = teams.indexOf(activeId);
      const to = teams.indexOf(overId);

      if (from === -1 || to === -1) {
        return current;
      }

      return {
        ...current,
        [groupKey]: arrayMove(teams, from, to),
      };
    });
  };

  const handleGroupDragEnd = (groupKey: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    moveTeam(groupKey, String(active.id), String(over.id));
  };

  const saveProgress = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToPersist));
  };

  const shareProgress = async () => {
    const encoded = encodeState(dataToPersist);
    const url = `${window.location.origin}${window.location.pathname}?state=${encodeURIComponent(encoded)}`;
    setShareUrl(url);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleFinalPick = (team: string) => {
    if (team === "TBD") {
      return;
    }

    setFinalWinner(team);
  };

  const resetAll = () => {
    setTitle(DEFAULT_TITLE);
    setGroups(initialGroups);
    setRound32Winners({});
    setRound16Winners({});
    setQuarterWinners({});
    setSemiWinners({});
    setFinalWinner("");
    setShareUrl("");
    setCopied(false);
    localStorage.removeItem(STORAGE_KEY);
    window.history.replaceState({}, "", window.location.pathname);
  };

  return (
    <main className="app-shell">
      <div className="stadium-glow stadium-glow--left" />
      <div className="stadium-glow stadium-glow--right" />
      <div className="pitch-lines" />
      <div className="container">
        <section className="hero-grid">
          <article className="panel hero-card">
            <div className="hero-card__topline">
              <span className="hero-icon">
                <IconTrophy />
              </span>
              <div className="hero-copy">
                <p className="eyebrow">Road to the Trophy</p>
                <h1>{title}</h1>
                <p className="hero-copy__text">
                  Grup sıralamalarını kur, eleme ağacını tamamla ve 2026 kupasının nasıl şekilleneceğini kendi senaryonla oluştur.
                </p>
              </div>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <span>48</span>
                <small>Takım</small>
              </div>
              <div className="hero-stat">
                <span>12</span>
                <small>Grup</small>
              </div>
              <div className="hero-stat">
                <span>32</span>
                <small>Eleme Slotu</small>
              </div>
            </div>

            <label className="field">
              <span className="field__label">Başlık</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>

            <div className="actions">
              <button type="button" className="button button--solid" onClick={saveProgress}>
                <IconSave />
                Kaydet
              </button>
              <button type="button" className="button button--ghost" onClick={shareProgress}>
                <IconShare />
                Paylaş
              </button>
              <button type="button" className="button button--ghost" onClick={resetAll}>
                <IconReset />
                Sıfırla
              </button>
            </div>

            {shareUrl ? (
              <div className="share-box">
                <strong>Paylaşım linki</strong>
                <p>{shareUrl}</p>
                <span>{copied ? "Panoya kopyalandı." : "Link üretildi."}</span>
              </div>
            ) : null}
          </article>

          <article className="panel info-card">
            <header className="section-header">
              <h2>Turnuva Akışı</h2>
            </header>
            <div className="info-list">
              <p>Takımları sürükleyip bırakarak grup sıralamasını gerçek zamanlı yeniden oluştur.</p>
              <p>Her aşamada sadece geçerli eşleşmeler seçilebilir, böylece eleme akışı temiz kalır.</p>
              <p>Final seçimin yapıldığında şampiyon kartı büyük biçimde hemen güncellenir.</p>
            </div>
            <div className="final-preview">
              <span className="eyebrow">Finalistler</span>
              <strong>{finalists.length === 2 ? `${finalists[0]} vs ${finalists[1]}` : "Finalistler henüz hazır değil"}</strong>
              <p>{championName ? `Şu an kupayı kaldıran takım: ${championName}` : "Şampiyon seçtiğinde bu alan anında güncellenir."}</p>
            </div>
          </article>
        </section>

        <section className="section-block">
          <div className="section-title">
            <div>
              <p className="section-kicker">Group Stage</p>
              <h2>Gruplar</h2>
            </div>
            <span className="pill">12 Grup • 48 Takım</span>
          </div>

          <div className="groups-grid">
            {Object.entries(groups).map(([group, teams]) => (
              <article key={group} className="panel group-card">
                <header className="group-card__header">
                  <div>
                    <span className="group-card__label">Pot</span>
                    <h3>Grup {group}</h3>
                  </div>
                  <span className="pill pill--soft">İlk 2 direkt</span>
                </header>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleGroupDragEnd(group, event)}
                >
                  <SortableContext items={teams} strategy={verticalListSortingStrategy}>
                    <div className="group-list">
                      {teams.map((team, index) => (
                        <TeamRow key={`${group}-${team}`} team={team} index={index} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-title">
            <div>
              <p className="section-kicker">Knockout Bracket</p>
              <h2>Eleme Aşaması</h2>
            </div>
          </div>

          <div className="knockout-section">
            <div className="stage-header">
              <h3>Son 32</h3>
            </div>
            <div className="matches-grid matches-grid--four">
              {round32Matches.map((match, index) => (
                <MatchCard
                  key={match.id}
                  title={`Maç ${index + 1}`}
                  teamA={match.teams[0].team}
                  teamB={match.teams[1].team}
                  winner={match.winner}
                  onPick={(team) => setRound32Winners((current) => ({ ...current, [match.id]: team }))}
                />
              ))}
            </div>
          </div>

          <div className="knockout-section">
            <div className="stage-header">
              <h3>Son 16</h3>
            </div>
            <div className="matches-grid matches-grid--four">
              {round16Matches.map((match, index) => (
                <MatchCard
                  key={match.id}
                  title={`Maç ${index + 1}`}
                  teamA={match.teams[0].team}
                  teamB={match.teams[1].team}
                  winner={match.winner}
                  onPick={(team) => setRound16Winners((current) => ({ ...current, [match.id]: team }))}
                />
              ))}
            </div>
          </div>

          <div className="knockout-section">
            <div className="stage-header">
              <h3>Çeyrek Final</h3>
            </div>
            <div className="matches-grid matches-grid--four">
              {quarterMatches.map((match, index) => (
                <MatchCard
                  key={match.id}
                  title={`Maç ${index + 1}`}
                  teamA={match.teams[0].team}
                  teamB={match.teams[1].team}
                  winner={match.winner}
                  onPick={(team) => setQuarterWinners((current) => ({ ...current, [match.id]: team }))}
                />
              ))}
            </div>
          </div>

          <div className="knockout-section">
            <div className="stage-header">
              <h3>Yarı Final</h3>
            </div>
            <div className="matches-grid matches-grid--two">
              {semiMatches.map((match, index) => (
                <MatchCard
                  key={match.id}
                  title={`Maç ${index + 1}`}
                  teamA={match.teams[0].team}
                  teamB={match.teams[1].team}
                  winner={match.winner}
                  onPick={(team) => setSemiWinners((current) => ({ ...current, [match.id]: team }))}
                />
              ))}
            </div>
          </div>

          <div className="knockout-section knockout-section--final">
            <div className="stage-header">
              <h3>Final</h3>
            </div>
            <div className="matches-grid matches-grid--final">
              <MatchCard
                title="Şampiyonluk Maçı"
                teamA={finalMatch[0].team}
                teamB={finalMatch[1].team}
                winner={championName}
                onPick={handleFinalPick}
              />

              <article className={`panel champion-card${championName ? " champion-card--selected" : ""}`}>
                <div className="champion-card__spotlight" />
                <div className="champion-card__crest">
                  <span className="champion-card__flag" aria-hidden="true">
                    {getFlag(championName)}
                  </span>
                  <span className="champion-card__icon">
                    <IconTrophy />
                  </span>
                </div>
                <p className="champion-card__label">🏆 Tahmini Dünya Kupası Şampiyonu</p>
                <h3>{championName || "Henüz seçilmedi"}</h3>
                <p className="champion-card__copy">
                  {championName
                    ? `${championName}, final galibi olarak state'e işlendi ve bu kartta net biçimde gösteriliyor.`
                    : "Final maçında bir takım seçtiğinde şampiyon burada büyük biçimde görünecek."}
                </p>
              </article>
            </div>
          </div>
        </section>
      </div>
      <div className="site-signature">Efehan Büyükbayrak</div>
    </main>
  );
}
