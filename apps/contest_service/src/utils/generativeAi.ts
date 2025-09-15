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
You are a cricket match analyst and contest designer.  
Your task is to generate multiple trivia contests for a future T20 cricket match.  

### Instructions:
1. Each contest should represent a different section of the match:
   - Pre-match (general predictions before the game starts)
   - Powerplay (first 6 overs of each innings)
   - Middle overs (7–15 overs)
   - Death overs (16–20 overs)
   - Full match summary contest

2. Each contest should include:
   - id (UUID)
   - description
   - type (e.g., "pre-match", "powerplay_innings_1", "death_overs_innings_2")
   - difficulty (Beginner, Intermediate, Advanced)
   - entry_fee (e.g., "100 Points")
   - prize_pool (e.g., "10,000 Points")
   - points_per_question (integer)
   - contest_display_enabled (boolean)
   - total_spots (integer)
   - filled_spots (integer, initially 0)
   - questions_count (integer)
   - join_deadline (e.g., "Before match")
   - result_time (e.g., "End of match")
   - time_commitment (string, e.g., "10 minutes")
   - is_popular (boolean)
   - questions (array)

3. Each contest should have 10–25 questions.
4. Each question should include:
   - question_number
   - question_text
   - question_type (one of: match_winner, runs_range, wickets, yes_no, player_performance, boundaries)
   - options (4–6 relevant options)
   - correct_answer (always null at generation time)

5. Use the following match data for context:
${matchData}

### Output:
Return the result strictly as a **JSON array of contests**, no markdown formatting, no explanation.  
Each contest must follow this schema exactly.  

Example top-level output:
[
  { ...contest1 },
  { ...contest2 },
  { ...contest3 }
]
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
      throw new Error("Error while fetching the data");
    }
  }
}

export default new GenerativeAi();
