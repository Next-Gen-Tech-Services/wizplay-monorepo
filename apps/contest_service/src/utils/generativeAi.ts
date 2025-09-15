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
}

export default new GenerativeAi();
