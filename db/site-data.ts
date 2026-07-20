import { env } from "cloudflare:workers";
import { balanceTeams } from "./team-balance";

export type Player = { id: number; nickname: string; tier: number; wins: number; losses: number; thumbnailKey: string | null };
export type Match = { id: number; scheduledAt: string; map: string; status: "scheduled" | "completed"; teamRed: string; teamBlue: string; redScore: number | null; blueScore: number | null; mvp: string | null; createdBy: string };
export type PlayerProfile = Player & { email: string };

let initialized = false;

async function db() {
  const binding = env.DB;
  if (!binding) throw new Error("D1 binding DB is required");
  if (!initialized) {
    await binding.batch([
      binding.prepare("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL UNIQUE, tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4), wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0)"),
      binding.prepare("CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, scheduled_at TEXT NOT NULL, map TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('scheduled','completed')), team_red TEXT NOT NULL, team_blue TEXT NOT NULL, red_score INTEGER, blue_score INTEGER, mvp TEXT, created_by TEXT NOT NULL)"),
      binding.prepare("CREATE TABLE IF NOT EXISTS player_profiles (player_id INTEGER PRIMARY KEY REFERENCES players(id), email TEXT NOT NULL UNIQUE, thumbnail_key TEXT)"),
      binding.prepare("CREATE TABLE IF NOT EXISTS match_players (match_id INTEGER NOT NULL REFERENCES matches(id), player_id INTEGER NOT NULL REFERENCES players(id), team TEXT NOT NULL CHECK (team IN ('A','B')), separated_group INTEGER, PRIMARY KEY (match_id, player_id))"),
      binding.prepare("CREATE INDEX IF NOT EXISTS matches_status_date_idx ON matches (status, scheduled_at)"),
    ]);
    await seed(binding);
    initialized = true;
  }
  return binding;
}

async function seed(binding: D1Database) {
  const players = [
    ["황금후라이드",1,18,6],["치킨무도사",1,15,7],["ARAMKING",1,12,6],["바삭한한타",1,11,6],
    ["닭다리헌터",2,13,9],["매운양념",2,11,9],["무지성눈덩이",2,9,8],["증강수집가",2,10,9],["눈덩이배송",2,8,8],
    ["부쉬속치킨",3,8,10],["포킹장인",3,7,10],["순살주의보",3,6,11],["닭날개",3,7,12],["부활대기중",3,5,9],
    ["칼바람새싹",4,4,10],["튀김옷",4,3,9],["치즈볼",4,2,8],["무적포로",4,4,12],
  ];
  await binding.batch(players.map((player) => binding.prepare("INSERT OR IGNORE INTO players (nickname,tier,wins,losses) VALUES (?,?,?,?)").bind(...player)));

  const count = await binding.prepare("SELECT COUNT(*) AS count FROM matches").first<{ count: number }>();
  if (!count?.count) {
    const matches = [
      ["2026-07-24T12:00:00.000Z","증강 칼바람 협곡","scheduled","황금후라이드, 무지성눈덩이, 포킹장인, 닭날개, 칼바람새싹","치킨무도사, 닭다리헌터, 부쉬속치킨, 순살주의보, 치즈볼",null,null,null],
      ["2026-07-27T11:30:00.000Z","증강 칼바람 협곡","scheduled","ARAMKING, 매운양념, 증강수집가, 부활대기중, 튀김옷","바삭한한타, 눈덩이배송, 부쉬속치킨, 닭날개, 무적포로",null,null,null],
      ["2026-07-18T12:00:00.000Z","증강 칼바람 협곡","completed","황금후라이드, 닭다리헌터, 포킹장인, 닭날개, 치즈볼","치킨무도사, 매운양념, 부쉬속치킨, 순살주의보, 칼바람새싹",2,1,"황금후라이드"],
      ["2026-07-15T11:30:00.000Z","증강 칼바람 협곡","completed","ARAMKING, 무지성눈덩이, 증강수집가, 부활대기중, 무적포로","바삭한한타, 닭다리헌터, 눈덩이배송, 순살주의보, 튀김옷",0,2,"치킨무도사"],
    ];
    await binding.batch(matches.map((match) => binding.prepare("INSERT INTO matches (scheduled_at,map,status,team_red,team_blue,red_score,blue_score,mvp,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(...match,"seed")));
  } else {
    await binding.batch([
      binding.prepare("UPDATE matches SET team_red=?, team_blue=? WHERE created_by='seed' AND scheduled_at=?").bind("황금후라이드, 무지성눈덩이, 포킹장인, 닭날개, 칼바람새싹", "치킨무도사, 닭다리헌터, 부쉬속치킨, 순살주의보, 치즈볼", "2026-07-24T12:00:00.000Z"),
      binding.prepare("UPDATE matches SET team_red=?, team_blue=? WHERE created_by='seed' AND scheduled_at=?").bind("ARAMKING, 매운양념, 증강수집가, 부활대기중, 튀김옷", "바삭한한타, 눈덩이배송, 부쉬속치킨, 닭날개, 무적포로", "2026-07-27T11:30:00.000Z"),
      binding.prepare("UPDATE matches SET team_red=?, team_blue=? WHERE created_by='seed' AND scheduled_at=?").bind("황금후라이드, 닭다리헌터, 포킹장인, 닭날개, 치즈볼", "치킨무도사, 매운양념, 부쉬속치킨, 순살주의보, 칼바람새싹", "2026-07-18T12:00:00.000Z"),
      binding.prepare("UPDATE matches SET team_red=?, team_blue=? WHERE created_by='seed' AND scheduled_at=?").bind("ARAMKING, 무지성눈덩이, 증강수집가, 부활대기중, 무적포로", "바삭한한타, 닭다리헌터, 눈덩이배송, 순살주의보, 튀김옷", "2026-07-15T11:30:00.000Z"),
    ]);
  }
}

export async function getPlayers(): Promise<Player[]> {
  const binding = await db();
  const result = await binding.prepare("SELECT p.id, p.nickname, p.tier, p.wins, p.losses, pp.thumbnail_key AS thumbnailKey FROM players p LEFT JOIN player_profiles pp ON pp.player_id = p.id ORDER BY p.tier ASC, CASE WHEN p.wins + p.losses = 0 THEN 0 ELSE p.wins * 1.0 / (p.wins + p.losses) END DESC, p.wins DESC").all<Player>();
  return result.results;
}

export async function getMatches(): Promise<Match[]> {
  const binding = await db();
  const result = await binding.prepare("SELECT id, scheduled_at AS scheduledAt, map, status, team_red AS teamRed, team_blue AS teamBlue, red_score AS redScore, blue_score AS blueScore, mvp, created_by AS createdBy FROM matches ORDER BY scheduled_at DESC").all<Match>();
  return result.results;
}

export async function createBalancedSchedule(input: { scheduledAt: string; map: string; playerIds: number[]; separatedGroups: number[][]; createdBy: string }) {
  const binding = await db();
  const allPlayers = await getPlayers();
  const selected = input.playerIds.map((id) => allPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const { teamA, teamB } = balanceTeams(selected, input.separatedGroups);
  const result = await binding.prepare("INSERT INTO matches (scheduled_at,map,status,team_red,team_blue,created_by) VALUES (?,?,?,?,?,?)").bind(input.scheduledAt, input.map, "scheduled", teamA.map((player) => player.nickname).join(", "), teamB.map((player) => player.nickname).join(", "), input.createdBy).run();
  const matchId = Number((result.meta as { last_row_id?: number }).last_row_id);
  if (matchId) {
    const groupByPlayer = new Map(input.separatedGroups.flatMap((group, index) => group.map((id) => [id, index + 1] as const)));
    await binding.batch([...teamA.map((player) => [player, "A"] as const), ...teamB.map((player) => [player, "B"] as const)].map(([player, team]) => binding.prepare("INSERT INTO match_players (match_id,player_id,team,separated_group) VALUES (?,?,?,?)").bind(matchId, player.id, team, groupByPlayer.get(player.id) ?? null)));
  }
}

export async function getPlayerProfile(email: string): Promise<PlayerProfile | null> {
  const binding = await db();
  return binding.prepare("SELECT p.id, p.nickname, p.tier, p.wins, p.losses, pp.email, pp.thumbnail_key AS thumbnailKey FROM player_profiles pp JOIN players p ON p.id = pp.player_id WHERE lower(pp.email)=lower(?)").bind(email).first<PlayerProfile>();
}

export async function getUnclaimedPlayers(): Promise<Player[]> {
  const binding = await db();
  const result = await binding.prepare("SELECT p.id, p.nickname, p.tier, p.wins, p.losses, NULL AS thumbnailKey FROM players p LEFT JOIN player_profiles pp ON pp.player_id=p.id WHERE pp.player_id IS NULL ORDER BY p.nickname").all<Player>();
  return result.results;
}

export async function claimPlayer(email: string, playerId: number) {
  const binding = await db();
  await binding.prepare("INSERT INTO player_profiles (player_id,email) VALUES (?,?)").bind(playerId, email).run();
}

export async function setPlayerThumbnail(playerId: number, thumbnailKey: string) {
  const binding = await db();
  await binding.prepare("UPDATE player_profiles SET thumbnail_key=? WHERE player_id=?").bind(thumbnailKey, playerId).run();
}

export async function getPlayerThumbnailKey(playerId: number) {
  const binding = await db();
  const row = await binding.prepare("SELECT thumbnail_key AS thumbnailKey FROM player_profiles WHERE player_id=?").bind(playerId).first<{ thumbnailKey: string | null }>();
  return row?.thumbnailKey ?? null;
}
