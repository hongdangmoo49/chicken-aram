import { env } from "cloudflare:workers";

export type Player = { id: number; nickname: string; tier: number; wins: number; losses: number };
export type Match = { id: number; scheduledAt: string; map: string; status: "scheduled" | "completed"; teamRed: string; teamBlue: string; redScore: number | null; blueScore: number | null; mvp: string | null; createdBy: string };

let initialized = false;

async function db() {
  const binding = env.DB;
  if (!binding) throw new Error("D1 binding DB is required");
  if (!initialized) {
    await binding.batch([
      binding.prepare("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL UNIQUE, tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4), wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0)"),
      binding.prepare("CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, scheduled_at TEXT NOT NULL, map TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('scheduled','completed')), team_red TEXT NOT NULL, team_blue TEXT NOT NULL, red_score INTEGER, blue_score INTEGER, mvp TEXT, created_by TEXT NOT NULL)"),
      binding.prepare("CREATE INDEX IF NOT EXISTS matches_status_date_idx ON matches (status, scheduled_at)"),
    ]);
    const count = await binding.prepare("SELECT COUNT(*) AS count FROM players").first<{ count: number }>();
    if (!count?.count) await seed(binding);
    initialized = true;
  }
  return binding;
}

async function seed(binding: D1Database) {
  const players = [
    ["황금후라이드",1,18,6],["치킨무도사",1,15,7],["ARAMKING",1,12,6],
    ["닭다리헌터",2,13,9],["매운양념",2,11,9],["무지성눈덩이",2,9,8],
    ["부쉬속치킨",3,8,10],["포킹장인",3,7,10],["순살주의보",3,6,11],
    ["칼바람새싹",4,4,10],["튀김옷",4,3,9],["치즈볼",4,2,8],
  ];
  const matches = [
    ["2026-07-24T12:00:00.000Z","증강 칼바람 협곡","scheduled","퇴근후한판","새벽의치킨단",null,null,null],
    ["2026-07-27T11:30:00.000Z","증강 칼바람 협곡","scheduled","직장인원정대","ARAM연구회",null,null,null],
    ["2026-07-18T12:00:00.000Z","증강 칼바람 협곡","completed","불금치킨단","눈덩이원정대",2,1,"황금후라이드"],
    ["2026-07-15T11:30:00.000Z","증강 칼바람 협곡","completed","포킹연구회","닭다리수비대",0,2,"치킨무도사"],
    ["2026-07-11T12:00:00.000Z","칼바람 나락","completed","순살파","양념파",1,2,"매운양념"],
    ["2026-07-08T12:00:00.000Z","증강 칼바람 협곡","completed","저녁반","새벽반",2,0,"ARAMKING"],
  ];
  await binding.batch([
    ...players.map((p) => binding.prepare("INSERT INTO players (nickname,tier,wins,losses) VALUES (?,?,?,?)").bind(...p)),
    ...matches.map((m) => binding.prepare("INSERT INTO matches (scheduled_at,map,status,team_red,team_blue,red_score,blue_score,mvp,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(...m,"seed")),
  ]);
}

export async function getPlayers(): Promise<Player[]> {
  const binding = await db();
  const result = await binding.prepare("SELECT id, nickname, tier, wins, losses FROM players ORDER BY tier ASC, CASE WHEN wins + losses = 0 THEN 0 ELSE wins * 1.0 / (wins + losses) END DESC, wins DESC").all<Player>();
  return result.results;
}

export async function getMatches(): Promise<Match[]> {
  const binding = await db();
  const result = await binding.prepare("SELECT id, scheduled_at AS scheduledAt, map, status, team_red AS teamRed, team_blue AS teamBlue, red_score AS redScore, blue_score AS blueScore, mvp, created_by AS createdBy FROM matches ORDER BY scheduled_at DESC").all<Match>();
  return result.results;
}

export async function createSchedule(input: Omit<Match, "id" | "status" | "redScore" | "blueScore" | "mvp">) {
  const binding = await db();
  await binding.prepare("INSERT INTO matches (scheduled_at,map,status,team_red,team_blue,created_by) VALUES (?,?,?,?,?,?)").bind(input.scheduledAt, input.map, "scheduled", input.teamRed, input.teamBlue, input.createdBy).run();
}
