import OpenAI from "openai";
import ServerConfigs from "../configs/server.config";
import { logger } from "@repo/common";


interface AnswerResponse {
   questionId: string;
   question: string;
   options: string[];
   answer: string | null;
   confidence: 'high' | 'medium' | 'low' | 'pending';
   reasoning: string;
   calculation?: {
      actualValue?: number;
      overRange?: string;
      phase?: string;
      dataSource?: string;
   };
}


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
         logger.info(`[CONTEST-GENERATION] Generating contests for match: ${JSON.stringify(matchData)}`);
         let teams = matchData.teams;
         let matchFormat = matchData.format || matchData.match_format || 't20';
         logger.info(`[CONTEST-GENERATION] Match format detected: ${matchFormat}`);
         
         const response = await this.openApiInstance.responses.create({
            model: "gpt-4.1",
            input: `You are a cricket contest generator.  
Your job is to create multiple contests for an upcoming cricket match.  
You MUST follow all rules below EXACTLY with zero variation.

CRITICAL: The match format is "${matchFormat}". You MUST generate contests ONLY for this format.

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
### 1. CONTEST GENERATION STRUCTURE (ALL FORMATS)
############################################################

IMPORTANT: The match format is "${matchFormat}".

Based on the match format "${matchFormat}", generate ONLY the appropriate contests below:

-----------------------------------------
### FOR T20 MATCHES (format = "t20" or "T20"):
-----------------------------------------
Generate these 7 contests:

1. T20 Pre-match Contest (type: "t20_prematch")
2. Powerplay Contest – Overs 1–6 (Innings 1) (type: "t20_powerplay1")
3. Middle Overs Contest – Overs 7–15 (Innings 1) (type: "t20_middle1")
4. Death Overs Contest – Overs 16–20 (Innings 1) (type: "t20_death1")
5. Powerplay Contest – Overs 1–6 (Innings 2) (type: "t20_powerplay2")
6. Middle Overs Contest – Overs 7–15 (Innings 2) (type: "t20_middle2")
7. Death Overs Contest – Overs 16–20 (Innings 2) (type: "t20_death2")

-----------------------------------------
### FOR T10 MATCHES (format = "t10" or "T10"):
-----------------------------------------
Generate these 5 contests:

1. T10 Pre-match Contest (type: "t10_prematch")
2. Powerplay Contest – Overs 1–6 (Innings 1) (type: "t10_powerplay1")
3. Death Overs Contest – Overs 7–10 (Innings 1) (type: "t10_death1")
4. Powerplay Contest – Overs 1–6 (Innings 2) (type: "t10_powerplay2")
5. Death Overs Contest – Overs 7–10 (Innings 2) (type: "t10_death2")

-----------------------------------------
### FOR ODI MATCHES (format = "odi" or "ODI"):
-----------------------------------------
Generate these 7 contests:

1. ODI Pre-match Contest (type: "odi_prematch")
2. Powerplay Contest – Overs 1–10 (Innings 1) (type: "odi_powerplay1")
3. Middle Overs Contest – Overs 11–40 (Innings 1) (type: "odi_middle1")
4. Death Overs Contest – Overs 41–50 (Innings 1) (type: "odi_death1")
5. Powerplay Contest – Overs 1–10 (Innings 2) (type: "odi_powerplay2")
6. Middle Overs Contest – Overs 11–40 (Innings 2) (type: "odi_middle2")
7. Death Overs Contest – Overs 41–50 (Innings 2) (type: "odi_death2")

-----------------------------------------
### FOR TEST MATCHES (format = "test" or "TEST"):
-----------------------------------------
Generate these 11 contests:

1. Test Pre-match Contest (type: "test_prematch")
2. Day 1 Session Contest (type: "test_day1")
3. Day 2 Session Contest (type: "test_day2")
4. Day 3 Session Contest (type: "test_day3")
5. Day 4 Session Contest (type: "test_day4")
6. Day 5 Session Contest (type: "test_day5")
7. First Innings Contest (type: "test_innings1")
8. Second Innings Contest (type: "test_innings2")
9. Third Innings Contest (type: "test_innings3")
10. Fourth Innings Contest (type: "test_innings4")
11. Match Summary Contest (type: "test_match_summary")  

############################################################
### 2. CONTEST OBJECT STRUCTURE (MUST MATCH EXACTLY)
############################################################
Each contest MUST include:

- id (UUID)
- title (string, simple, use exact names from section 1)
- description (1–2 lines max, simple description)
- type (MUST match contest type from section 1 based on format:
   * T20: t20_prematch, t20_powerplay1, t20_middle1, t20_death1, t20_powerplay2, t20_middle2, t20_death2
   * T10: t10_prematch, t10_powerplay1, t10_death1, t10_powerplay2, t10_death2
   * ODI: odi_prematch, odi_powerplay1, odi_middle1, odi_death1, odi_powerplay2, odi_middle2, odi_death2
   * Test: test_prematch, test_day1-5, test_innings1-4, test_match_summary)
- difficulty ("beginner" | "intermediate" | "advanced")
- entryFee (number, 10-20 for beginner, 50-100 for intermediate, 200-500 for advanced)
- prizePool (number, 2-5x entryFee)
- pointsPerQuestion (always 10)
- contest_display_enabled (always true)
- totalSpots (100-500)
- filledSpots (always 0)
- questions_count (always 10)
- joinDeadline (string, ISO format)
- resultTime (string, ISO format)
- timeCommitment (string, must match type field)
- isPopular (false for most, true for 1-2 contests)
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
### 4. FIXED QUESTION TEMPLATES (ALL FORMATS - SIMPLE VERSION)
############################################################

============================
T20 PRE-MATCH CONTEST
============================
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
   
2. Toss winner will bat or bowl first?
   Options: ["Bat first", "Bowl first"]
   
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
   
4. Will the match be won by 20+ runs or 5+ wickets?
   Options: ["Yes", "No"]
   
5. Which team will score more boundaries?
   Options: [${teams.a.name}, ${teams.b.name}]
   
6. Will any team score 180+ runs?
   Options: ["Yes", "No"]
   
7. Will there be a super over?
   Options: ["Yes", "No"]
   
8. Will the match finish in less than 40 overs total?
   Options: ["Yes", "No"]
   
9. Will the winning team chase or defend?
   Options: ["Chase", "Defend"]
   
10. Which innings will have higher score?
    Options: ["First innings", "Second innings"]

============================
T20 POWERPLAY (OVERS 1-6) - INNINGS 1
============================
1. Runs in powerplay (overs 1-6)?
   Options: ["0-30", "31-45", "46-60", "61+"]
   
2. Wickets in powerplay?
   Options: ["0", "1", "2", "3+"]
   
3. Boundaries (4s+6s) in powerplay?
   Options: ["0-3", "4-6", "7-9", "10+"]
   
4. Will any over go for 12+ runs?
   Options: ["Yes", "No"]
   
5. Dot balls in powerplay?
   Options: ["0-10", "11-20", "21-30", "31+"]
   
6. Will there be a maiden over?
   Options: ["Yes", "No"]
   
7. Extras in powerplay?
   Options: ["0-2", "3-5", "6+"]
   
8. Will a six be hit?
   Options: ["Yes", "No"]
   
9. Wicket in first over?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-5", "6-10", "11-15", "16+"]

============================
T20 MIDDLE OVERS (OVERS 7-15) - INNINGS 1
============================
1. Runs in middle overs (7-15)?
   Options: ["20-40", "41-60", "61-80", "81+"]
   
2. Wickets in middle overs?
   Options: ["0", "1", "2", "3+"]
   
3. Boundaries in middle overs?
   Options: ["0-3", "4-6", "7-9", "10+"]
   
4. Will any over go for 14+ runs?
   Options: ["Yes", "No"]
   
5. Dot balls in middle overs?
   Options: ["0-15", "16-30", "31-45", "46+"]
   
6. Will there be a maiden over?
   Options: ["Yes", "No"]
   
7. Extras in middle overs?
   Options: ["0-2", "3-5", "6+"]
   
8. Will a six be hit?
   Options: ["Yes", "No"]
   
9. Wicket to spin bowling?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-7", "8-12", "13-17", "18+"]

============================
T20 DEATH OVERS (OVERS 16-20) - INNINGS 1
============================
1. Runs in death overs (16-20)?
   Options: ["10-30", "31-50", "51-70", "71+"]
   
2. Wickets in death overs?
   Options: ["0", "1", "2", "3+"]
   
3. Sixes in death overs?
   Options: ["0", "1-2", "3-4", "5+"]
   
4. Boundaries (4s+6s) in death overs?
   Options: ["0-2", "3-5", "6-8", "9+"]
   
5. Will any over go for 15+ runs?
   Options: ["Yes", "No"]
   
6. Dot balls in death overs?
   Options: ["0-3", "4-7", "8-11", "12+"]
   
7. Extras in death overs?
   Options: ["0-2", "3-5", "6+"]
   
8. Wicket in final over (20th)?
   Options: ["Yes", "No"]
   
9. Six in final over?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-10", "11-15", "16-20", "21+"]

============================
T10 PRE-MATCH CONTEST
============================
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
   
2. Toss winner will bat or bowl first?
   Options: ["Bat first", "Bowl first"]
   
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
   
4. Will the match be won by 15+ runs or 4+ wickets?
   Options: ["Yes", "No"]
   
5. Which team will score more boundaries?
   Options: [${teams.a.name}, ${teams.b.name}]
   
6. Will any team score 100+ runs?
   Options: ["Yes", "No"]
   
7. Will there be a super over?
   Options: ["Yes", "No"]
   
8. Will the match finish in less than 20 overs total?
   Options: ["Yes", "No"]
   
9. Will the winning team chase or defend?
   Options: ["Chase", "Defend"]
   
10. Which innings will have higher score?
    Options: ["First innings", "Second innings"]

============================
T10 POWERPLAY (OVERS 1-6) - INNINGS 1
============================
1. Runs in powerplay (overs 1-6)?
   Options: ["0-25", "26-40", "41-55", "56+"]
   
2. Wickets in powerplay?
   Options: ["0", "1", "2", "3+"]
   
3. Boundaries (4s+6s) in powerplay?
   Options: ["0-3", "4-7", "8-11", "12+"]
   
4. Will any over go for 15+ runs?
   Options: ["Yes", "No"]
   
5. Dot balls in powerplay?
   Options: ["0-5", "6-10", "11-15", "16+"]
   
6. Extras in powerplay?
   Options: ["0-2", "3-5", "6+"]
   
7. Will a six be hit?
   Options: ["Yes", "No"]
   
8. Wicket in first over?
   Options: ["Yes", "No"]
   
9. Will there be 3+ sixes?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-7", "8-14", "15-20", "21+"]

============================
T10 DEATH OVERS (OVERS 7-10) - INNINGS 1
============================
1. Runs in death overs (7-10)?
   Options: ["0-20", "21-35", "36-50", "51+"]
   
2. Wickets in death overs?
   Options: ["0", "1", "2", "3+"]
   
3. Sixes in death overs?
   Options: ["0", "1-2", "3-4", "5+"]
   
4. Boundaries (4s+6s) in death overs?
   Options: ["0-2", "3-5", "6-8", "9+"]
   
5. Will any over go for 18+ runs?
   Options: ["Yes", "No"]
   
6. Dot balls in death overs?
   Options: ["0-2", "3-5", "6-8", "9+"]
   
7. Extras in death overs?
   Options: ["0-2", "3-4", "5+"]
   
8. Wicket in final over (10th)?
   Options: ["Yes", "No"]
   
9. Six in final over?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-12", "13-18", "19-24", "25+"]

============================
ODI PRE-MATCH CONTEST
============================
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
   
2. Toss winner will bat or bowl first?
   Options: ["Bat first", "Bowl first"]
   
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}]
   
4. Will the match be won by 50+ runs or 6+ wickets?
   Options: ["Yes", "No"]
   
5. Which team will score more boundaries?
   Options: [${teams.a.name}, ${teams.b.name}]
   
6. Will any team score 300+ runs?
   Options: ["Yes", "No"]
   
7. Will there be a century scored?
   Options: ["Yes", "No"]
   
8. Will the match finish before 50th over of 2nd innings?
   Options: ["Yes", "No"]
   
9. Will the winning team chase or defend?
   Options: ["Chase", "Defend"]
   
10. Which innings will have higher score?
    Options: ["First innings", "Second innings"]

============================
ODI POWERPLAY (OVERS 1-10) - INNINGS 1
============================
1. Runs in powerplay (overs 1-10)?
   Options: ["0-35", "36-50", "51-65", "66+"]
   
2. Wickets in powerplay?
   Options: ["0", "1", "2", "3+"]
   
3. Boundaries (4s+6s) in powerplay?
   Options: ["0-4", "5-8", "9-12", "13+"]
   
4. Will any over go for 12+ runs?
   Options: ["Yes", "No"]
   
5. Dot balls in powerplay?
   Options: ["0-15", "16-30", "31-45", "46+"]
   
6. Will there be a maiden over?
   Options: ["Yes", "No"]
   
7. Extras in powerplay?
   Options: ["0-2", "3-5", "6+"]
   
8. Will a six be hit?
   Options: ["Yes", "No"]
   
9. Wicket in first over?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-6", "7-11", "12-16", "17+"]

============================
ODI MIDDLE OVERS (OVERS 11-40) - INNINGS 1
============================
1. Runs in middle overs (11-40)?
   Options: ["50-100", "101-150", "151-200", "201+"]
   
2. Wickets in middle overs?
   Options: ["0-1", "2-3", "4-5", "6+"]
   
3. Boundaries in middle overs?
   Options: ["0-6", "7-12", "13-18", "19+"]
   
4. Will any over go for 14+ runs?
   Options: ["Yes", "No"]
   
5. Dot balls in middle overs?
   Options: ["0-30", "31-60", "61-90", "91+"]
   
6. Will there be a maiden over?
   Options: ["Yes", "No"]
   
7. Extras in middle overs?
   Options: ["0-3", "4-7", "8+"]
   
8. Will a six be hit?
   Options: ["Yes", "No"]
   
9. Wicket to spin bowling?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-7", "8-13", "14-19", "20+"]

============================
ODI DEATH OVERS (OVERS 41-50) - INNINGS 1
============================
1. Runs in death overs (41-50)?
   Options: ["20-40", "41-60", "61-80", "81+"]
   
2. Wickets in death overs?
   Options: ["0", "1", "2", "3+"]
   
3. Sixes in death overs?
   Options: ["0", "1-2", "3-4", "5+"]
   
4. Boundaries (4s+6s) in death overs?
   Options: ["0-3", "4-6", "7-9", "10+"]
   
5. Will any over go for 15+ runs?
   Options: ["Yes", "No"]
   
6. Dot balls in death overs?
   Options: ["0-5", "6-10", "11-15", "16+"]
   
7. Extras in death overs?
   Options: ["0-2", "3-5", "6+"]
   
8. Wicket in final over (50th)?
   Options: ["Yes", "No"]
   
9. Six in final over?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-10", "11-15", "16-20", "21+"]

============================
TEST PRE-MATCH CONTEST
============================
1. Who will win the toss?
   Options: [${teams.a.name}, ${teams.b.name}]
   
2. Toss winner will bat or bowl first?
   Options: ["Bat first", "Bowl first"]
   
3. Which team will win the match?
   Options: [${teams.a.name}, ${teams.b.name}, "Draw"]
   
4. Will the match end in a draw?
   Options: ["Yes", "No"]
   
5. Will the match last all 5 days?
   Options: ["Yes", "No"]
   
6. Which team will score more runs (total)?
   Options: [${teams.a.name}, ${teams.b.name}]
   
7. Will any team score 400+ in an innings?
   Options: ["Yes", "No"]
   
8. Will there be a century scored?
   Options: ["Yes", "No"]
   
9. Will there be a follow-on?
   Options: ["Yes", "No"]
   
10. Will the winning team bat first?
    Options: ["Yes", "No"]

============================
TEST DAY SESSION CONTEST (DAY 1-5)
============================
1. Runs in this day session?
   Options: ["0-100", "101-200", "201-300", "301+"]
   
2. Wickets in this session?
   Options: ["0-2", "3-5", "6-8", "9+"]
   
3. Boundaries (4s+6s) in session?
   Options: ["0-10", "11-20", "21-30", "31+"]
   
4. Will there be 3+ maiden overs?
   Options: ["Yes", "No"]
   
5. Dot balls in session?
   Options: ["0-50", "51-100", "101-150", "151+"]
   
6. Will a wicket fall in first over?
   Options: ["Yes", "No"]
   
7. Extras in session?
   Options: ["0-5", "6-10", "11+"]
   
8. Will a six be hit?
   Options: ["Yes", "No"]
   
9. Will a partnership of 50+ occur?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-6", "7-12", "13-18", "19+"]

============================
TEST INNINGS CONTEST
============================
1. Total runs in this innings?
   Options: ["0-200", "201-300", "301-400", "401+"]
   
2. Total wickets fallen?
   Options: ["1-4", "5-7", "8-9", "All out (10)"]
   
3. Boundaries (4s+6s) in innings?
   Options: ["0-20", "21-40", "41-60", "61+"]
   
4. Sixes in innings?
   Options: ["0-2", "3-5", "6-8", "9+"]
   
5. Will innings last 60+ overs?
   Options: ["Yes", "No"]
   
6. Will there be a 100+ run partnership?
   Options: ["Yes", "No"]
   
7. Extras in innings?
   Options: ["0-10", "11-20", "21-30", "31+"]
   
8. Will a century be scored?
   Options: ["Yes", "No"]
   
9. Will wickets fall to spin bowling?
   Options: ["Yes", "No"]
   
10. Highest scoring over?
    Options: ["0-8", "9-15", "16-22", "23+"]

============================
TEST MATCH SUMMARY CONTEST
============================
1. Total runs in the match (both teams)?
   Options: ["0-600", "601-900", "901-1200", "1201+"]
   
2. Total wickets fallen in match?
   Options: ["0-10", "11-20", "21-30", "31+"]
   
3. Will match result in draw?
   Options: ["Yes", "No"]
   
4. Days played?
   Options: ["1-2 days", "3 days", "4 days", "Full 5 days"]
   
5. Will there be a follow-on?
   Options: ["Yes", "No"]
   
6. Total centuries scored?
   Options: ["0", "1", "2", "3+"]
   
7. Total sixes in match?
   Options: ["0-5", "6-10", "11-15", "16+"]
   
8. Will any team be all out under 150?
   Options: ["Yes", "No"]
   
9. Will winning margin be innings victory?
   Options: ["Yes", "No"]
   
10. Which team scores more total runs?
    Options: [${teams.a.name}, ${teams.b.name}]

============================
INNINGS 2 CONTESTS (ALL FORMATS)
============================
For all Innings 2 contests (Powerplay, Middle, Death):
USE THE EXACT SAME QUESTIONS AS INNINGS 1, just replace ${teams.a.name} with ${teams.b.name} where team name appears.
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

############################################################
### 5. OUTPUT REQUIREMENTS
############################################################
- CRITICAL: Generate contests ONLY for format "${matchFormat}"
- If format is T20: Generate 7 T20 contests
- If format is T10: Generate 5 T10 contests  
- If format is ODI: Generate 7 ODI contests
- If format is TEST: Generate 11 Test contests
- Output ONLY a JSON array
- NO markdown, NO explanation, NO extra text
- Use team names from matchData: ${JSON.stringify(teams)}
- All questions must use exact templates above
- Match type field to contest type (e.g., t20_prematch, odi_powerplay1, test_day1)
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

   /**
  * Generate answers for all questions based on match data and live data
  */
   async generateAnswers(
      matchData: any,
      liveData: any,
      questions: any[]
   ): Promise<AnswerResponse[]> {
      try {
         const prompt = this.buildAnswerGenerationPrompt(
            matchData,
            liveData,
            questions
         );

         logger.info("Generating answers with prompt:", matchData);

         const response = await this.openApiInstance.responses.create({
            model: "gpt-4.1",
            input: prompt,
         });

         const result = JSON.parse(
            response.output[0].content[0].text
               .replace("```json", "")
               .replace("```", "")
               .trim()
         ); 

         return result;
      } catch (error) {
         console.error("Error generating answers:", error);
         throw new Error("Error while generating answers");
      }
   }
   private buildAnswerGenerationPrompt(
      matchData: any,
      liveData: any,
      questions: any[]
   ): string {
    return `
You are a deterministic cricket match analyzer.  
Your ONLY job is to extract answers from the EXACT JSON provided.  

###############################
### HARD NON-NEGOTIABLE RULES
###############################
1. YOU MUST read values from the JSON exactly as given.  
2. YOU MUST NOT say data is missing unless the JSON path literally does not exist.  
3. If a field exists ANYWHERE in the provided JSON text, assume it is available and USE IT.  
4. You MUST NOT ignore "liveData" or "matchData".  
5. NEVER guess any data. NEVER hallucinate missing fields.  
6. Output ONLY the JSON array — no markdown, no commentary, no code fences.

###############################
### CRITICAL OVERRIDE RULE
###############################
If "liveData" contains the fields:
- liveData.toss.winner  
- liveData.toss.decision  
- liveData.innings  
- liveData.innings[*].score  
- liveData.innings[*].batting  

YOU MUST treat these fields as present and use them.  
You are NOT allowed to say they are missing.

###############################
### INPUT JSON (READ IT CAREFULLY)
###############################

MATCH DATA:
${JSON.stringify(matchData, null, 2)}

LIVE MATCH DATA:
${JSON.stringify(liveData, null, 2)}

QUESTIONS:
${JSON.stringify(questions, null, 2)}

###############################
### EXTRACTION LOGIC (STRICT)
###############################

TOSS:
- winnerKey = liveData.toss.winner
- winnerName = liveData.teams[winnerKey].name
- decision = liveData.toss.decision
   - "bat" → "Bat first"
   - "bowl" → "Bowl first"

MATCH WINNER:
- key = matchData.winner
- name = matchData.teams[key].name

INNINGS:
- innings1 = liveData.innings[0]
- innings2 = liveData.innings[1]

BOUNDARIES:
For each batting entry:
 boundaries = fours + sixes

MATCH MARGIN:
If winner == innings2.team:
  marginWickets = 10 - innings2.score.wickets
Else:
  marginRuns = innings1.score.runs - innings2.score.runs

OVERS:
Convert "X.Y" → X + (Y / 6)

SUPER OVER:
If matchData.status == "completed" AND matchData.winner exists → "No"

###############################
### OUTPUT FORMAT
###############################

Return EXACTLY:
[
  {
    "questionId": "...",
    "question": "...",
    "options": [...],
    "answer": "value OR null",
    "confidence": "high|medium|low|pending",
    "reasoning": "Explain exact JSON paths used",
    "calculation": {
      "actualValue": "...",
      "dataSource": ["json.path"],
      "notes": "optional"
    }
  }
]

NO OTHER TEXT OUTSIDE THE ARRAY.
NO MARKDOWN.
NO EXPLANATIONS.
`;


   }


}

export default new GenerativeAi();
