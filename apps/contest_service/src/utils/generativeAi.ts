import OpenAI from "openai";
import ServerConfigs from "../configs/server.config";

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
        model: "gpt-4.1",
        input: `Consider you are a match analyst. Generate an future cricket match trivia contest with 10 questions each with 4 probable answer options. Here is the match data: ${matchData} and here is the type of question ${contestDescription} for which you need to generate the questions and their respective probable options. give the data in key value json format. the top level data should have key as match_trivia`,
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
      const response = await this.openApiInstance.responses.create({
        model: "gpt-4.1",
        input: `
You are a cricket contest generator.  
Your job is to create multiple trivia contests for an upcoming cricket match.  
The match format can be **Test, ODI, T20, or T10**.  

### Contest Design Rules:
1. Generate contests based on match format and phases:
   - **Test Matches** → Sessions (Morning, Afternoon, Evening), Day-wise contests, Innings summaries.
   - **ODI (50 overs)** → Pre-match, Powerplay (1–10 overs), Middle overs (11–40), Death overs (41–50), Full match.
   - **T20 (20 overs)** → Pre-match, Powerplay (1–6), Middle overs (7–15), Death overs (16–20), Full match.
   - **T10 (10 overs)** → Pre-match, Powerplay (1–3), Middle overs (4–7), Death overs (8–10), Full match.

2. Each contest must include:
   - id (UUID)
   - title (string)
   - description (string)
   - type (e.g., "pre-match", "powerplay_innings_1", "session_day1_morning")
   - difficulty (Beginner | Intermediate | Advanced)
   - entryFee (number)
   - prizePool (number)
   - pointsPerQuestion (number)
   - contest_display_enabled (boolean)
   - totalSpots (integer)
   - filledSpots (integer, always 0)
   - questions_count (integer)
   - joinDeadline (string, e.g., "Before match")
   - resultTime (string, e.g., "End of match" or "End of Day 1")
   - timeCommitment (string, e.g., "10 minutes")
   - isPopular (boolean)
   - questions (array)

3. Each contest should have **10–25 questions**.
4. Each question must include:
   - question_number (integer)
   - question_text (string)
   - question_type (one of: match_winner, runs_range, wickets, yes_no, player_performance, boundaries, partnerships, session_score)
   - options (4–6 relevant options)
   - correct_answer (always null)

5. Use the following match data for context:
${matchData}

### Output:
Return only a **JSON array of contests**, no markdown, no explanation.  
Each contest must follow the schema exactly.  

Example:
[
  { ...contest1 },
  { ...contest2 },
  { ...contest3 }
]`,
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
}

export default new GenerativeAi();
