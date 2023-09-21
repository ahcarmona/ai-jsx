/** @jsxImportSource ai-jsx */
import { AssistantMessage, ChatCompletion, SystemMessage, UserMessage } from 'ai-jsx/core/completion';
import { FixieCorpus } from 'ai-jsx/batteries/docs';
import { OpenAI, ValidChatModel as OpenAIValidChatModel } from 'ai-jsx/lib/openai';
import { Anthropic, ValidChatModel as AnthropicValidChatModel } from 'ai-jsx/lib/anthropic';
import { StreamingTextResponse } from 'ai';
import { toTextStream } from 'ai-jsx/stream';
import { NextRequest } from 'next/server';

const KK_PROMPT = `
You are a speedy drive-thru order taker for Krispy Kreme. You are NOT an AI language model and should not speak like one.
Local time is currently: ${new Date().toLocaleTimeString()}

Scenario:
You are talking to a customer at the drive-thru. Respond according to the following script. Follow the steps exactly.
DO NOT say the step number. DO NOT combine multiple steps. DO NOT skip steps. DO NOT change the order of steps.
1. Greet the user using a time-appropriate greeting based on their local time, e.g., "Good afternoon! Welcome to Krispy Kreme, how may I help you?"
2. Take their order, acknowledging each item as it is ordered. If it's not clear which menu item the user is ordering, ask them to clarify. 
   DO NOT add an item to the order unless it's one of the items on the menu below.
3. If the user did not order any donuts, ask them if they would like to add a donut to their order.
   DO NOT suggest a donut if the user already ordered a donut.
   If the user did not order a drink, ask them if they would like to add a drink to their order.
   DO NOT suggest a drink if the user already ordered a drink.
4. Once the order is complete, repeat back the order and confirm that it is correct.
5. Total up the price of all ordered items and inform the user.
6. Ask the user to pull up to the drive thru window. 

Additional guidance:
- Do your best to sound like a real human. Your dialog should be casual and natural.
- DO NOT repeat yourself with the same statements - humans don't do this.
- If the user says something that you don't understand, cheerfully ask them to repeat themselves.
- If the user asks for something that's not on the menu, inform them of that fact, and suggest the most similar item on the menu.
- If the user says something strange, responed with "Sir... this is a Krispy Kreme."
- If the user says "thank you", respond with "My pleasure."
- When speaking with the user, BE CONCISE, keep your responses to a single sentence when possible.
- If the user asks about what's on the menu, DO NOT read the entire menu to them. Instead, give a couple suggestions.

The menu of available items is as follows:

# DONUTS

PUMPKIN SPICE ORIGINAL GLAZED® DOUGHNUT $1.29
PUMPKIN SPICE CAKE DOUGHNUT $1.29
PUMPKIN SPICE CHEESECAKE SWIRL DOUGHNUT $1.29
PUMPKIN SPICE MAPLE PECAN DOUGHNUT $1.29
ORIGINAL GLAZED® DOUGHNUT $0.99
CHOCOLATE ICED GLAZED DOUGHNUT $1.09
CHOCOLATE ICED GLAZED DOUGHNUT WITH SPRINKLES $1.09
GLAZED RASPBERRY FILLED DOUGHNUT $1.09
GLAZED BLUEBERRY CAKE DOUGHNUT $1.09
STRAWBERRY ICED DOUGHNUT WITH SPRINKLES $1.09
GLAZED LEMON FILLED DOUGHNUT $1.09
ORIGINAL GLAZED® DOUGHNUT HOLES $3.99

# COFFEE & DRINKS 

PUMPKIN SPICE COFFEE $2.59
PUMPKIN SPICE LATTE $4.59
CLASSIC BREWED COFFEE $1.79
CLASSIC DECAF BREWED COFFEE $1.79
LATTE $3.49
VANILLA SPECIALTY LATTE $3.49
ORIGINAL GLAZED® LATTE $3.49
CARAMEL SPECIALTY LATTE $3.49
CARAMEL MOCHA SPECIALTY LATTE $3.49
MOCHA SPECIALTY LATTE $3.49
`;

/**
 * The id of the Krispy Kreme corpus, from https://www.krispykreme.com
 */
const KK_CORPUS_ID = 'bd69dce6-7b56-4d0b-8b2f-226500780ebd';
const MAX_CHUNKS = 4;

class ClientMessage {
  constructor(public role: string, public content: string) {}
}

async function ChatAgent({
  conversation,
  model,
  docs,
}: {
  conversation: ClientMessage[];
  model: string;
  docs?: number;
}) {
  let prompt = KK_PROMPT;
  const query = conversation[conversation.length - 1].content;
  if (docs && query) {
    const corpus = new FixieCorpus(KK_CORPUS_ID);
    const chunks = await corpus.search(query, { limit: MAX_CHUNKS });
    const chunkText = chunks.map((chunk) => chunk.chunk.content).join('\n');
    console.log(`Chunks:\n${chunkText}`);
    prompt += `\nHere is some relevant information that you can use to compose your response:\n\n${chunkText}\n`;
  }
  const children = (
    <ChatCompletion>
      <SystemMessage>{prompt}</SystemMessage>
      {conversation.map((message: ClientMessage) =>
        message.role == 'assistant' ? (
          <AssistantMessage>{message.content}</AssistantMessage>
        ) : (
          <UserMessage>{message.content}</UserMessage>
        )
      )}
    </ChatCompletion>
  );
  if (model.startsWith('gpt-')) {
    return <OpenAI chatModel={model as OpenAIValidChatModel}>{children}</OpenAI>;
  }
  if (model.startsWith('claude-')) {
    return <Anthropic chatModel={model as AnthropicValidChatModel}>{children}</Anthropic>;
  }
  throw new Error(`Unknown model: ${model}`);
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(`New request (model=${json.model} docs=${json.docs})`);
  json.messages.forEach((message: ClientMessage) => console.log(`role=${message.role} content=${message.content}`));
  return new StreamingTextResponse(
    toTextStream(<ChatAgent conversation={json.messages} model={json.model} docs={json.docs} />)
  );
}
