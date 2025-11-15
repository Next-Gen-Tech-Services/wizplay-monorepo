import OpenAI from "openai";
import ServerConfigs from "../configs/server.config";
import { logger } from "@repo/common";

export class GenerativeAi {
  private apiKey: string;
  private openApiInstance: any;
  constructor() {
    this.apiKey = ServerConfigs.OPEN_API_KEY;
    this.openApiInstance = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  async generateQuestions(matchData: any, contestDescription: string) {
    try {
      const response = await this.openApiInstance.responses.create({
        model: "gpt-5.1",
        input: `Consider you are a match analyst. Generate an future cricket match contest with 10 questions each with 4 probable answer options. Here is the match data: ${matchData} and here is the type of question ${contestDescription} for which you need to generate the questions and their respective probable options. give the data in key value json format. the top level data should have key as match`,
      });
      const result = JSON.parse(
        response.output[0].content[0].text
          .replace("```json", "")
          .replace("```", "")
          .trim()
      );
      return result;
    } catch (error) {
      throw new Error("Error while fetching the data");
    }
  }

  async generateContest(matchData: any) {
    try {
      logger.info(`[CONTEST-GENERATION] Generating contests for match: ${matchData}`);
      let teams = matchData.teams;
      const response = await this.openApiInstance.responses.create({
        model: "gpt-4.1",
        input: `You are a cricket contest generator.  
Your job is to create multiple contests for an upcoming cricket match.  
You MUST follow all rules below EXACTLY with zero variation.

Your output MUST be:
- A JSON array of contests
- NO markdown
- NO explanation
- NO extra text

############################################################
### 0. UNIVERSAL RULES (APPLY TO ALL FORMATS & PHASES)
############################################################
1. Every contest MUST have EXACTLY **10 questions**.
2. ALL questions MUST come from the fixed templates below.
3. NO player-specific questions are allowed.
4. Only team names may change dynamically using matchData.
5. You MUST NOT invent new questions, options, or formats.
6. Every question must be simple, deterministic, objective, and fully calculable from live data.
7. Option order MUST remain exactly as defined.

############################################################
### 1. CONTEST GENERATION STRUCTURE (FORMAT-DEPENDENT)
############################################################

Based on match format in matchData.format, generate the following contests:

-----------------------------------------
### FOR T20 MATCHES:
-----------------------------------------
You MUST generate these 8 contests:

1. T20 Pre-match Contest  
2. Powerplay Contest – Overs 1–6 (Innings 1)  
3. Middle Overs Contest – Overs 7–15 (Innings 1)  
4. Death Overs Contest – Overs 16–20 (Innings 1)  
5. Powerplay Contest – Overs 1–6 (Innings 2)  
6. Middle Overs Contest – Overs 7–15 (Innings 2)  
7. Death Overs Contest – Overs 16–20 (Innings 2)  

-----------------------------------------
### FOR ODI MATCHES:
-----------------------------------------
You MUST generate these 8 contests:

1. ODI Pre-match Contest  
2. Powerplay Contest – Overs 1–10 (Innings 1)  
3. Middle Overs Contest – Overs 11–40 (Innings 1)  
4. Death Overs Contest – Overs 41–50 (Innings 1)  
5. Powerplay Contest – Overs 1–10 (Innings 2)  
6. Middle Overs Contest – Overs 11–40 (Innings 2)  
7. Death Overs Contest – Overs 41–50 (Innings 2)  

-----------------------------------------
### FOR TEST MATCHES:
-----------------------------------------
You MUST generate:

1. Test Pre-match Contest  
2. Day 1 Morning Session Contest  
3. Day 1 Afternoon Session Contest  
4. Day 1 Evening Session Contest  
5. Day 2 Morning Session Contest  
6. Day 2 Afternoon Session Contest  
7. Day 2 Evening Session Contest  
8. Day 3 Morning Session Contest  
9. Day 3 Afternoon Session Contest  
10. Day 3 Evening Session Contest  
11. Day 4 Morning Session Contest  
12. Day 4 Afternoon Session Contest  
13. Day 4 Evening Session Contest  
14. Day 5 Morning Session Contest  
15. Day 5 Afternoon Session Contest  
16. Day 5 Evening Session Contest  
17. Innings Summary – Innings 1  
18. Innings Summary – Innings 2  

############################################################
### 2. CONTEST OBJECT STRUCTURE (MUST MATCH EXACTLY)
############################################################
Each contest MUST include:

- id (UUID)
- title (string, simple, fixed names defined below)
- description (1–2 lines max)
- type (string identifying the phase, e.g., "t20_prematch", "test_day1_morning")
- difficulty ("Beginner" | "Intermediate" | "Advanced")
- entryFee (number)
- prizePool (number)
- pointsPerQuestion (number)
- contest_display_enabled (boolean)
- totalSpots (integer)
- filledSpots (always 0)
- questions_count (always 10)
- joinDeadline (string)
- resultTime (string)
- timeCommitment (string)
- isPopular (boolean)
- questions (array of exactly 10 question objects)

############################################################
### 3. QUESTION STRUCTURE (MANDATORY)
############################################################
Each question MUST have:

- question_number (1–10)
- question_text (use EXACT text from templates)
- question_type (one of: match_winner, runs_range, wickets, yes_no, player_performance, boundaries, partnerships, session_score)
- options (exactly as defined in the templates)
- correct_answer: null

############################################################
### 4. FIXED QUESTION TEMPLATES (NO VARIATION ALLOWED)
############################################################

============================
T20 MATCH TEMPLATES
============================

### T20 Pre-match Contest
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
2. What will the toss-winning team choose?
   Options: ["Bat first", "Bowl first"]
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
4. Will the match be decided by more than 20 runs or 6 wickets?
   Options: ["Yes", "No"]
5. Which team will hit more boundaries?
   Options: [${teams.a.name}, ${teams.b.name}]
6. Which innings will have the higher total?
   Options: ["Innings 1", "Innings 2"]
7. Will either team score 180+?
   Options: ["Yes", "No"]
8. Will both teams hit at least 6 sixes?
   Options: ["Yes", "No"]
9. Will there be a super over?
   Options: ["Yes", "No"]
10. Will the match finish by the 19th over of the second innings?
   Options: ["Yes", "No"]
11. Will the winning team chase or defend?
    Options: ["Chase", "Defend"]


### T20 Powerplay Contest – Overs 1–6 (Innings 1)
1. How many runs will ${teams.a.name} score in overs 1–6?
   Options: ["0–25", "26–40", "41–55", "56–70", "71+"]
2. How many wickets will fall in overs 1–6?
   Options: ["0", "1", "2", "3+"]
3. How many boundaries (4s + 6s) will be hit in overs 1–6?
   Options: ["0–2", "3–4", "5–6", "7+"]
4. Will any over in the powerplay concede 12+ runs?
   Options: ["Yes", "No"]
5. How many extras will be conceded in overs 1–6?
   Options: ["0", "1–2", "3–4", "5+"]
6. Will the first wicket fall inside the powerplay?
   Options: ["Yes", "No"]
7. Will ${teams.a.name} hit a six in the powerplay?
   Options: ["Yes", "No"]
8. How many dot balls will be bowled in overs 1–6?
   Options: ["0–6", "7–12", "13–18", "19+"]
9. How many overs in the powerplay will be maiden?
   Options: ["0", "1", "2+"]
10. What will be the highest scoring over in the powerplay?
    Options: ["0–5 runs", "6–10 runs", "11–15 runs", "16+ runs"]

### T20 Middle Overs Contest – Overs 7–15 (Innings 1)
1. How many runs will ${teams.a.name} score in overs 7–15?
   Options: ["20–35", "36–50", "51–65", "66–80", "81+"]
2. How many wickets will fall in overs 7–15?
   Options: ["0", "1", "2", "3+"]
3. How many boundaries will be hit in overs 7–15?
   Options: ["0–2", "3–5", "6–8", "9+"]
4. Will there be a maiden over in overs 7–15?
   Options: ["Yes", "No"]
5. How many extras will be conceded in overs 7–15?
   Options: ["0", "1–2", "3–4", "5+"]
6. Will ${teams.a.name} lose a wicket to spin in overs 7–15?
   Options: ["Yes", "No"]
7. Will any over go for 14+ runs?
   Options: ["Yes", "No"]
8. How many dot balls will occur in overs 7–15?
   Options: ["0–10", "11–20", "21–30", "31+"]
9. Will a six be hit in overs 7–15?
   Options: ["Yes", "No"]
10. What will be the highest scoring over in overs 7–15?
    Options: ["0–5", "6–10", "11–15", "16+"]

### T20 Death Overs Contest – Overs 16–20 (Innings 1)
1. How many runs will ${teams.a.name} score in overs 16–20?
   Options: ["10–19", "20–29", "30–39", "40–49", "50+"]
2. How many wickets will fall in overs 16–20?
   Options: ["0", "1", "2", "3+"]
3. How many sixes will be hit in overs 16–20?
   Options: ["0", "1–2", "3–4", "5+"]
4. How many boundaries (4s+6s) will be hit?
   Options: ["0–1", "2–3", "4–5", "6+"]
5. Will ${teams.a.name} score 15+ runs in any death over?
   Options: ["Yes", "No"]
6. How many dot balls will occur in overs 16–20?
   Options: ["0–3", "4–6", "7–9", "10+"]
7. How many extras will be conceded in overs 16–20?
   Options: ["0", "1–2", "3–4", "5+"]
8. Will a wicket fall in the 20th over?
   Options: ["Yes", "No"]
9. Will ${teams.a.name} hit a six in the final over?
   Options: ["Yes", "No"]
10. What will be the highest scoring over?
    Options: ["0–10", "11–15", "16–20", "21+"]

### T20 Powerplay Contest – Overs 1–6 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 POWERPLAY, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**

### T20 Middle Overs Contest – Overs 7–15 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 MIDDLE OVERS, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**

### T20 Death Overs Contest – Overs 16–20 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 DEATH OVERS, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**



============================
ODI MATCH TEMPLATES
============================

### ODI Pre-match Contest
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
2. What will the toss-winning team choose?
   Options: ["Bat first", "Bowl first"]
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
4. Will the match be decided by more than 50 runs or 6 wickets?
   Options: ["Yes", "No"]
5. Which team will hit more boundaries?
   Options: [${teams.a.name}, ${teams.b.name}]
6. Which innings will have the higher total?
   Options: ["Innings 1", "Innings 2"]
7. Will either team score 300+?
   Options: ["Yes", "No"]
8. Will both teams hit at least 8 sixes?
   Options: ["Yes", "No"]

9. Will the match finish before the 50th over of the second innings?
   Options: ["Yes", "No"]
10. Will there be a century scored?
   Options: ["Yes", "No"]
11. Will the winning team chase or defend?
    Options: ["Chase", "Defend"]

### ODI Powerplay Contest – Overs 1–10 (Innings 1)
1. How many runs will ${teams.a.name} score in overs 1–10?
   Options: ["0–30", "31–45", "46–60", "61–75", "76+"]
2. How many wickets will fall in the powerplay?
   Options: ["0", "1", "2", "3+"]
3. How many boundaries will be hit in overs 1–10?
   Options: ["0–3", "4–6", "7–9", "10+"]
4. Will any over go for 12+ runs?
   Options: ["Yes", "No"]
5. How many dot balls will be bowled in overs 1–10?
   Options: ["0–12", "13–24", "25–36", "37+"]
6. Will ${teams.a.name} lose a wicket in the first over?
   Options: ["Yes", "No"]
7. How many extras will be conceded?
   Options: ["0", "1–2", "3–5", "6+"]
8. Will a six be hit in the powerplay?
   Options: ["Yes", "No"]
9. Will there be a maiden over in overs 1–10?
   Options: ["Yes", "No"]
10. What will be the highest scoring over?
    Options: ["0–5", "6–10", "11–15", "16+"]

### ODI Middle Overs Contest – Overs 11–40 (Innings 1)
1. How many runs will ${teams.a.name} score in overs 11–40?
   Options: ["40–70", "71–100", "101–130", "131–160", "161+"]
2. How many wickets will fall?
   Options: ["0", "1", "2", "3–4", "5+"]
3. How many boundaries will be hit?
   Options: ["0–4", "5–8", "9–12", "13+"]
4. How many overs will go for 10+ runs?
   Options: ["0", "1", "2–3", "4+"]
5. How many dot balls will be bowled?
   Options: ["0–20", "21–40", "41–60", "61+"]
6. How many extras will be conceded?
   Options: ["0–2", "3–5", "6–8", "9+"]
7. Will ${teams.a.name} hit a six in middle overs?
   Options: ["Yes", "No"]
8. Will a wicket fall to spin?
   Options: ["Yes", "No"]
9. Will any over be maiden?
   Options: ["Yes", "No"]
10. Will any over concede 15+ runs?
    Options: ["Yes", "No"]

### ODI Death Overs Contest – Overs 41–50 (Innings 1)
1. How many runs will ${teams.a.name} score?
   Options: ["10–24", "25–39", "40–54", "55–69", "70+"]
2. How many wickets will fall?
   Options: ["0", "1", "2", "3+"]
3. How many sixes will be hit?
   Options: ["0", "1", "2", "3+"]
4. How many boundaries (4s + 6s)?
   Options: ["0–1", "2–3", "4–5", "6+"]
5. Will any over go for 16+ runs?
   Options: ["Yes", "No"]
6. How many dot balls will be bowled?
   Options: ["0–3", "4–6", "7–9", "10+"]
7. How many extras will be conceded?
   Options: ["0", "1–2", "3–4", "5+"]
8. Will a six be hit in the 50th over?
   Options: ["Yes", "No"]
9. Will ${teams.a.name} lose a wicket in the 50th over?
   Options: ["Yes", "No"]
10. What will be the highest scoring over?
    Options: ["0–8", "9–14", "15–20", "21+"]

### ODI Powerplay Contest – Overs 1–10 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 POWERPLAY, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**

### ODI Middle Overs Contest – Overs 11–40 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 MIDDLE OVERS, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**

### ODI Death Overs Contest – Overs 41–50 (Innings 2)
**USE EXACT SAME QUESTIONS AS INNINGS 1 DEATH OVERS, BUT REPLACE ${teams.a.name} WITH ${teams.b.name}**



============================
TEST MATCH TEMPLATES
============================

### Test Pre-match Contest
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
2. What will the toss-winning team choose?
   Options: ["Bat first", "Bowl first"]
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
4. Will the match end in a draw?
   Options: ["Yes", "No"]
5. Will the match last all 5 days?
   Options: ["Yes", "No"]
6. Which team will score more total runs across both innings?
   Options: [${teams.a.name}, ${teams.b.name}]
7. Will any team score 400+?
   Options: ["Yes", "No"]
8. Will any team be bowled out in under 50 overs?
   Options: ["Yes", "No"]

9. Will either team hit 10+ sixes across the match?
   Options: ["Yes", "No"]
10. Will there be a follow-on?
   Options: ["Yes", "No"]
11. Will the winning team chase or defend?
    Options: ["Chase", "Defend"]

### Test Session Contest – (Morning/Afternoon/Evening Session)
**NOTE: Use ${teams.current_batting} to dynamically insert the batting team**

1. How many runs will ${teams.current_batting} score in this session?
   Options: ["0–30", "31–60", "61–90", "91–120", "121+"]
2. How many wickets will fall?
   Options: ["0", "1", "2", "3–4", "5+"]
3. How many boundaries will be hit?
   Options: ["0–3", "4–7", "8–11", "12+"]
4. How many maidens will be bowled?
   Options: ["0", "1", "2–3", "4+"]
5. How many overs will go for 8+ runs?
   Options: ["0", "1", "2–3", "4+"]
6. How many extras will be conceded?
   Options: ["0", "1–2", "3–4", "5+"]
7. Will a wicket fall in the first over of the session?
   Options: ["Yes", "No"]
8. Will a six be hit in this session?
   Options: ["Yes", "No"]

9. Will any bowler bowl 6+ overs in this session?
    Options: ["Yes", "No"]

### Test Innings Summary Contest
1. What will be the total score of the innings?
   Options: ["0–149", "150–249", "250–349", "350–449", "450+"]
2. How many wickets will fall?
   Options: ["5–6", "7–8", "9", "10"]
3. How many boundaries (4s + 6s) will be hit?
   Options: ["0–20", "21–40", "41–60", "61+"]
4. How many sixes will be hit?
   Options: ["0", "1–2", "3–4", "5+"]
5. How many extras will be conceded?
   Options: ["0–5", "6–10", "11–15", "16+"]
6. Will a partnership of 100+ runs occur?
   Options: ["Yes", "No"]
7. Will there be a wicket in the first 5 overs?
   Options: ["Yes", "No"]
8. Will there be a maiden in the first 10 overs?
   Options: ["Yes", "No"]

9. Will the innings last more than 90 overs?
    Options: ["Yes", "No"]



############################################################
### 5. MATCH DATA CONTEXT
############################################################
Use the following match data to populate team names, match format, and other dynamic values:

${matchData}

############################################################
### 6. OUTPUT REQUIREMENTS
############################################################
- Output ONLY a JSON array containing all contests for the match format.
- NO markdown.
- NO explanation.
- NO additional text.
`,
      });

      const result = JSON.parse(
        response.output[0].content[0].text
          .replace("```json", "")
          .replace("```", "")
          .trim()
      );

      return result;
    } catch (error) {
      logger.error(`[CONTEST-GENERATION] Error generating contests for match: ${error}`);
      throw new Error("Error while fetching the data");
    }
  }
}

export default new GenerativeAi();
