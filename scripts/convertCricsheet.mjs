import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateLiveWinProbability } from "../lib/matchUtils.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CLI & Environment Argument Support: node convertCricsheet.mjs [inputFile] [outputFile] [chasingTeam]
const inputArg = process.argv[2] || process.env.CRICSHEET_INPUT_FILE;
const inputPath = inputArg ? path.resolve(inputArg) : null;
const defaultOutputDir = process.env.MATCH_DATA_DIR ? path.resolve(process.env.MATCH_DATA_DIR) : path.join(__dirname, "..", "lib", "data");
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : process.env.CRICSHEET_OUTPUT_FILE
  ? path.resolve(process.env.CRICSHEET_OUTPUT_FILE)
  : path.join(defaultOutputDir, "ind-pak-2022-t20-wc.json");

if (!inputPath || !fs.existsSync(inputPath)) {
  if (inputPath) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }
  console.log("Usage: node convertCricsheet.mjs <cricsheet-json-file> [output-file] [chasingTeam]");
  console.log("Environment variables supported: CRICSHEET_INPUT_FILE, CRICSHEET_OUTPUT_FILE, MATCH_DATA_DIR");
  process.exit(0);
}

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const rawData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const info = rawData.info || {};
const teams = info.teams || ["Team 1", "Team 2"];

// Name normalization map with fallback for known abbreviations
const NAME_MAP = {
  "KL Rahul": "KL Rahul",
  "RG Sharma": "Rohit Sharma",
  "V Kohli": "Virat Kohli",
  "SA Yadav": "Suryakumar Yadav",
  "AR Patel": "Axar Patel",
  "HH Pandya": "Hardik Pandya",
  "KD Karthik": "Dinesh Karthik",
  "R Ashwin": "Ravichandran Ashwin",
  "Mohammed Shami": "Mohammed Shami",
  "B Kumar": "Bhuvneshwar Kumar",
  "Arshdeep Singh": "Arshdeep Singh",
  "Mohammad Rizwan": "Mohammad Rizwan",
  "Babar Azam": "Babar Azam",
  "Shan Masood": "Shan Masood",
  "Iftikhar Ahmed": "Iftikhar Ahmed",
  "Shadab Khan": "Shadab Khan",
  "Haider Ali": "Haider Ali",
  "Mohammad Nawaz": "Mohammad Nawaz",
  "Asif Ali": "Asif Ali",
  "Shaheen Shah Afridi": "Shaheen Shah Afridi",
  "Haris Rauf": "Haris Rauf",
  "Naseem Shah": "Naseem Shah",
};

function formatName(name) {
  if (!name) return "";
  return NAME_MAP[name] || name;
}

// 1st innings analysis (defending team)
const firstInnings = rawData.innings && rawData.innings.length > 0 ? rawData.innings[0] : null;
let firstInningsRuns = 0;
let firstInningsWickets = 0;

if (firstInnings && firstInnings.overs) {
  for (const overObj of firstInnings.overs) {
    for (const d of overObj.deliveries || []) {
      firstInningsRuns += d.runs?.total || 0;
      if (d.wickets && d.wickets.length > 0) {
        firstInningsWickets += d.wickets.length;
      }
    }
  }
}

// 2nd innings resolution (chasing team)
const requestedChasingTeam = process.argv[4];
let chaseInnings = null;

if (requestedChasingTeam) {
  chaseInnings = rawData.innings.find(inn => inn.team?.toLowerCase() === requestedChasingTeam.toLowerCase());
}

if (!chaseInnings) {
  // Default to 2nd innings if available, else innings with a target
  chaseInnings = rawData.innings?.length > 1 ? rawData.innings[1] : rawData.innings?.find(inn => inn.target);
}

if (!chaseInnings) {
  console.error("Error: Could not identify chasing (2nd) innings in match data.");
  process.exit(1);
}

const chasingTeam = chaseInnings.team || teams[1] || "Chasing Team";
const defendingTeam = firstInnings?.team || teams.find(t => t !== chasingTeam) || "Defending Team";

const target = chaseInnings.target?.runs || (firstInningsRuns > 0 ? firstInningsRuns + 1 : 160);
const firstInningsScoreStr = `${firstInningsRuns}/${firstInningsWickets}`;

let cumulativeScore = 0;
let cumulativeWickets = 0;
const balls = [];
const oversCount = info.overs || 20;

for (const overObj of chaseInnings.overs || []) {
  const overNumber = overObj.over; // 0-indexed (0 = over 1)
  let legalBallInOver = 0;

  for (let dIdx = 0; dIdx < overObj.deliveries.length; dIdx++) {
    const d = overObj.deliveries[dIdx];
    const isWide = !!d.extras?.wides;
    const isNoBall = !!d.extras?.noballs;
    const isExtra = isWide || isNoBall;

    if (!isExtra) {
      legalBallInOver++;
    }

    const batterRuns = d.runs.batter || 0;
    const extraRuns = d.runs.extras || 0;
    const totalRuns = d.runs.total || 0;
    cumulativeScore += totalRuns;

    let wicket = false;
    let wicketType = undefined;
    let dismissedPlayer = undefined;

    if (d.wickets && d.wickets.length > 0) {
      wicket = true;
      cumulativeWickets += d.wickets.length;
      const w = d.wickets[0];
      wicketType = w.kind;
      dismissedPlayer = formatName(w.player_out);
    }

    const batter = formatName(d.batter);
    const bowler = formatName(d.bowler);
    const nonStriker = formatName(d.non_striker);

    const isBoundaryFour = batterRuns === 4;
    const isSix = batterRuns === 6;

    // Ball commentary generation from dynamic event details
    let commentary = "";
    if (wicket) {
      commentary = `WICKET! ${bowler} removes ${dismissedPlayer} (${wicketType})! Breakthrough for ${defendingTeam}.`;
    } else if (isSix) {
      commentary = `SIX! Magnificent hit by ${batter} off ${bowler}! Clears the fence cleanly.`;
    } else if (isBoundaryFour) {
      commentary = `FOUR! Beautifully timed by ${batter} off ${bowler}, finds the gap to the fence.`;
    } else if (isWide) {
      commentary = `Wide ball down the leg side by ${bowler}. Extra run conceded.`;
    } else if (isNoBall) {
      commentary = `No ball called against ${bowler}! Free hit coming up for ${batter}.`;
    } else if (totalRuns === 0) {
      commentary = `Dot ball. ${bowler} bowls tight line to ${batter}, no run conceded.`;
    } else if (totalRuns === 1) {
      commentary = `${batter} pushes ${bowler} into the gap for a brisk single.`;
    } else if (totalRuns === 2) {
      commentary = `Sharp running by ${batter} and ${nonStriker}, turning one into two.`;
    } else if (totalRuns === 3) {
      commentary = `Good placement into the deep, batters hustle back for 3 runs.`;
    } else {
      commentary = `${totalRuns} runs added off ${bowler}'s delivery.`;
    }

    // Win probability model:
    // Unified logistic model from matchUtils.ts
    const ballsBowled = (overNumber * 6) + (legalBallInOver > 0 ? legalBallInOver : 1);
    const winProb = calculateLiveWinProbability(target, cumulativeScore, cumulativeWickets, ballsBowled, oversCount);

    balls.push({
      over: overNumber,
      ball: dIdx + 1,
      legalBall: legalBallInOver,
      isExtra,
      extraType: isWide ? "wides" : isNoBall ? "noballs" : undefined,
      batter,
      bowler,
      nonStriker,
      runs: totalRuns,
      batterRuns,
      isBoundaryFour,
      isSix,
      wicket,
      wicketType,
      dismissedPlayer,
      commentary,
      winProbability: winProb,
      cumulativeScore,
      cumulativeWickets,
    });
  }
}

// Find default live point cutoff (e.g. over 15.0 or 75% through innings)
const targetCutoffOver = Math.round(oversCount * 0.75);
const liveCutoffIdx = balls.findIndex(b => b.over === (targetCutoffOver - 1) && b.legalBall === 6);
const liveBallIndex = liveCutoffIdx !== -1 ? liveCutoffIdx : Math.min(balls.length - 1, 90);
const liveBall = balls[liveBallIndex];
const currentLiveOver = liveBall ? (liveBall.legalBall === 6 ? liveBall.over + 1 : Number(`${liveBall.over}.${liveBall.legalBall}`)) : targetCutoffOver;

const matchSlug = `${chasingTeam.slice(0, 3).toLowerCase()}-${defendingTeam.slice(0, 3).toLowerCase()}-${info.dates?.[0]?.split("-")?.[0] || "match"}`;
const eventTitle = info.event?.name ? `${chasingTeam} vs ${defendingTeam}, ${info.event.name}` : `${chasingTeam} vs ${defendingTeam}`;
const venueString = info.venue ? (info.city ? `${info.venue}, ${info.city}` : info.venue) : "Cricket Ground";

const matchMeta = {
  matchId: path.basename(outputPath, ".json"),
  title: eventTitle,
  team1: defendingTeam,
  team2: chasingTeam,
  venue: venueString,
  format: (info.match_type || "T20").toUpperCase(),
  totalOvers: oversCount,
  target,
  firstInningsScore: firstInningsScoreStr,
  liveBallIndex,
  currentLiveOver,
  innings: 2,
  isMatchFinished: false,
};

// Dynamically extract squads for all participating teams
const dynamicSquads = {};
if (info.players) {
  for (const [tName, pList] of Object.entries(info.players)) {
    dynamicSquads[tName] = (pList || []).map(formatName);
  }
}

const fullOutput = {
  meta: matchMeta,
  balls,
  squads: dynamicSquads,
};

fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2), "utf-8");
console.log(`Successfully converted Cricsheet match:`);
console.log(`- Match: ${matchMeta.title}`);
console.log(`- Teams: ${matchMeta.team2} chasing ${matchMeta.target} set by ${matchMeta.team1} (${matchMeta.firstInningsScore})`);
console.log(`- Deliveries count: ${balls.length}`);
console.log(`- Total score: ${cumulativeScore}/${cumulativeWickets}`);
console.log(`- Live point ball index: ${liveBallIndex} (Over ${matchMeta.currentLiveOver})`);
console.log(`- Output saved to: ${outputPath}`);
