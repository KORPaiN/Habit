import type { Locale } from "@/lib/locale";
import type { OnboardingBaseInput } from "@/lib/validators/habit";

export type AnchorCueType =
  | "morning"
  | "shower"
  | "coffee"
  | "midday"
  | "appointment"
  | "commute"
  | "request"
  | "conflict"
  | "outside"
  | "evening"
  | "bedtime"
  | "default";

const STRESS_GOAL_PATTERN =
  /stress|anxiety|calm|peace|relax|reset|overwhelm|mindful|breath|breathe|meditat|gratitude|slow down|긴장|스트레스|불안|진정|차분|평온|마음 챙김|마음챙김|호흡|숨|명상|감사|쉬기|마음 가라앉/i;

const COMMON_ANCHOR_EXAMPLES_KO = [
  "아침에 일어나면",
  "샤워 물을 틀면",
  "커피를 따르면",
  "점심을 마치면",
  "약속 장소에 도착하면",
  "지하철에 앉으면",
  "저녁 정리를 마치면",
  "침대에 누우면",
] as const;

const COMMON_ANCHOR_EXAMPLES_EN = [
  "After I wake up",
  "After I turn on the shower",
  "After I pour my coffee or tea",
  "After I finish lunch",
  "After I arrive at my appointment",
  "After I sit down on the train",
  "After I clean up from dinner",
  "After I get in bed",
] as const;

export function isStressReliefGoal(goal: string) {
  return STRESS_GOAL_PATTERN.test(goal.toLowerCase());
}

export function detectAnchorCueType(anchor: string): AnchorCueType {
  const normalized = anchor.toLowerCase();

  if (/wake|morning|아침|일어나/.test(normalized)) {
    return "morning";
  }

  if (/shower|샤워|bath|욕조|목욕/.test(normalized)) {
    return "shower";
  }

  if (/coffee|tea|커피|차/.test(normalized)) {
    return "coffee";
  }

  if (/lunch|점심/.test(normalized)) {
    return "midday";
  }

  if (/appointment|meeting|약속|병원|상담/.test(normalized)) {
    return "appointment";
  }

  if (/train|bus|subway|commute|지하철|기차|버스|출근길|퇴근길/.test(normalized)) {
    return "commute";
  }

  if (/email|mail|pta|request|ask for help|메일|이메일|부탁|요청/.test(normalized)) {
    return "request";
  }

  if (/upset|conflict|argument|family member|화|짜증|다투|언쟁|가족/.test(normalized)) {
    return "conflict";
  }

  if (/walk|outside|dog|산책|밖|바깥/.test(normalized)) {
    return "outside";
  }

  if (/bed|pillow|잠|침대|베개/.test(normalized)) {
    return "bedtime";
  }

  if (/dinner|kids to bed|clean up|저녁|설거지|퇴근 후|아이 재우/.test(normalized)) {
    return "evening";
  }

  return "default";
}

export function getLearnedCommonAnchorExamples(locale: Locale = "ko") {
  return locale === "ko" ? [...COMMON_ANCHOR_EXAMPLES_KO] : [...COMMON_ANCHOR_EXAMPLES_EN];
}

export function getDefaultLearnedAnchor(preferredTime: OnboardingBaseInput["preferredTime"], locale: Locale = "ko") {
  if (locale !== "ko") {
    if (preferredTime === "evening") {
      return "After I get in bed";
    }

    if (preferredTime === "afternoon") {
      return "After I finish lunch";
    }

    return "After I pour my coffee or tea";
  }

  if (preferredTime === "evening") {
    return "침대에 누우면";
  }

  if (preferredTime === "afternoon") {
    return "점심을 마치면";
  }

  return "커피를 따르면";
}

export function buildStressPromptInstructions(anchor: string | undefined, locale: Locale = "ko") {
  const cueType = detectAnchorCueType(anchor ?? "");

  if (locale !== "ko") {
    const generic = [
      "For stress relief, prefer body-based reset actions such as one slow breath, shoulders down, a short walk, one light off, warm tea, or opening a journal.",
    ];

    switch (cueType) {
      case "coffee":
        return [...generic, "Coffee or tea cues pair well with putting the cup down, breathing three times, or opening a journal."];
      case "midday":
      case "appointment":
      case "commute":
        return [...generic, "Lunch, waiting, or commute cues pair well with stepping outside, turning the phone over, or one quiet minute."];
      case "evening":
      case "bedtime":
        return [...generic, "Evening or bed cues pair well with dimming the room, making tea, or breathing with eyes closed."];
      case "request":
      case "conflict":
        return [...generic, "Stress-spike cues pair well with pausing, drinking water, stepping away, or writing one short note."];
      default:
        return [...generic, "Match the cue when helpful, and keep the action shorter than the emotional resistance."];
    }
  }

  const generic = ["스트레스 완화 행동은 몸이나 환경부터 바로 바꾸는 작은 동작을 우선하세요."];

  switch (cueType) {
    case "coffee":
      return [...generic, "커피나 차 cue에는 컵 내려놓기, 숨 세 번, 어깨 내리기, 노트 열기가 잘 맞습니다."];
    case "midday":
    case "appointment":
    case "commute":
      return [...generic, "점심 뒤나 이동 중 cue에는 잠깐 밖으로 나가기, 휴대폰 뒤집기, 1분 호흡이 잘 맞습니다."];
    case "evening":
    case "bedtime":
      return [...generic, "저녁이나 침대 cue에는 불 하나 끄기, 차 물 올리기, 눈 감고 숨 세 번이 잘 맞습니다."];
    case "request":
    case "conflict":
      return [...generic, "스트레스가 확 올라오는 cue에는 바로 답하거나 해결하려 하지 말고, 멈추기나 물 한 컵 같은 작은 진정 동작을 고르세요."];
    default:
      return [...generic, "습관이 분명하면 그 cue에 잘 붙는 호흡, 조명, 걷기, 차, 메모 계열 행동을 우선하세요."];
  }
}
