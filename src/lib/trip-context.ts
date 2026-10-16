import type { ChatTurn } from "./ask";

const marker = "To tailor your packing list:";
const tripRequest =
  /\b(pack(?:ing)?|plan(?:ning)?|prepar(?:e|ing)|what (?:should|do) I (?:bring|need))\b/i;
const tripKind = /\b(camp(?:ing)?|hik(?:e|ing)|trip|travel|weekend away)\b/i;
const escape =
  /\b(basic (?:list|checklist)|just (?:a |the )?(?:list|basics)|(?:don't|do not) (?:ask|know)|unknown|not sure|assum(?:e|ptions)|skip(?: (?:the )?questions)?)\b/i;
const duration =
  /\b(?:\d+|one|two|three|four|five|six|seven|a)\s*[- ]?(?:night|day|week)s?\b|\b(?:weekend|overnight|day hike)\b/i;
const conditions =
  /\b(?:rain\w*|snow\w*|sunny|hot|warm|cold|cool|dry|wet|freezing|mild|winter|summer|spring|autumn|fall|\d+\s*°?[cf])\b/i;
const destination =
  /\b(?:in|to|near|at|around)\s+(?!camp\b|pack\b|a\b|the\b|my\b|be\b|go\b)[a-z][a-z -]{1,60}/i;
const style =
  /\b(?:car camp\w*|backpack\w*|wild camp\w*|campsite|campground|tent|cabin|hotel|work|business|day hike|rv|camper)\b/i;

export function tripContext(question: string, history: ChatTurn[] = []) {
  const last = history.at(-1);
  const pending = last?.answer.startsWith(marker);
  const explicit = tripRequest.test(question) && tripKind.test(question);
  const revision = /^(?:please )?(?:remove|leave|exclude|without|add)\b/i;
  const unrelated =
    /^(?:where|show|find|list|rename|delete|update|edit|what (?:is|are))\b/i;
  const anchorIndex = history.findLastIndex(
    (turn) =>
      tripRequest.test(turn.question) &&
      tripKind.test(turn.question) &&
      !revision.test(turn.question),
  );
  const continuing =
    (!explicit || revision.test(question)) &&
    anchorIndex >= 0 &&
    (pending ||
      revision.test(question) ||
      escape.test(question) ||
      duration.test(question) ||
      conditions.test(question) ||
      style.test(question)) &&
    !unrelated.test(question);
  if (!explicit && !continuing) return null;
  const earlier = continuing
    ? history.slice(anchorIndex).map((turn) => turn.question)
    : [];
  const supplied = [...earlier, question].join("\n").slice(-4000);
  const bareDestination = (text: string) =>
    !escape.test(text) &&
    /^(?!I\b|It\b|We\b|The\b|Not\b|Maybe\b)[A-Z][A-Za-z '-]{2,60}(?:,|[.!]|$)/.test(
      text,
    );
  const knownBareDestination =
    continuing &&
    ((pending && bareDestination(question)) ||
      history
        .slice(anchorIndex + 1)
        .some(
          (turn, index) =>
            history[anchorIndex + index].answer.startsWith(marker) &&
            bareDestination(turn.question),
        ));
  const camping = /\b(camp(?:ing)?|hik(?:e|ing))\b/i.test(supplied);
  const missing = {
    destination: !destination.test(supplied) && !knownBareDestination,
    conditions: !conditions.test(supplied),
    duration: !duration.test(supplied),
    style: camping && !style.test(supplied),
  };
  const optedOut = escape.test(supplied);
  const alreadyAsked = continuing && Boolean(history[anchorIndex]?.answer);
  const questions = [
    missing.destination || missing.conditions
      ? `${missing.destination ? "Where are you going" : "For that destination"}${missing.conditions ? ", and what dates or weather conditions do you expect" : ""}? I can use conditions you provide, but I don't have a live forecast.`
      : null,
    missing.duration ? "How many days or nights will you be away?" : null,
    missing.style
      ? "Will you be car camping, backpacking, or staying in a cabin or established campsite?"
      : null,
  ].filter((value): value is string => Boolean(value));
  if (questions.length && !optedOut && !alreadyAsked)
    return {
      clarification: `${marker}\n${questions.map((text, i) => `${i + 1}. ${text}`).join("\n")}\nAnswer what you know, or say “basic list” or “assume” to proceed with a provisional list.`,
    };
  const assumptions = [
    missing.destination ? "destination unspecified" : null,
    missing.conditions
      ? "weather unverified; check expected conditions before departure"
      : null,
    missing.duration
      ? "short trip for a starting list; quantities must be adjusted"
      : null,
    missing.style
      ? "camping style unspecified; confirm shelter and carrying needs"
      : null,
  ].filter(Boolean);
  return {
    question: continuing
      ? `${earlier[0]}\nUser-supplied trip details and revisions:\n${[...earlier.slice(1), question].join("\n")}`
      : question,
    summary: `${continuing ? `Trip details supplied: ${[...earlier.slice(1), question].join("; ").slice(0, 700)}\n` : ""}${assumptions.length ? `Provisional assumptions: ${assumptions.join("; ")}.\n` : ""}`,
  };
}
