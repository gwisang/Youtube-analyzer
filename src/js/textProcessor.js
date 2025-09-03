// Basic Korean stopwords list
const KOREAN_STOPWORDS = new Set([
  '이', '가', '은', '는', '을', '를', '도', '의', '에', '에서', '와', '과', '하고', '보다', '처럼', '같이',
  '하다', '되다', '이다', '있다', '없다', '않다', '같다', '싶다', '보다',
  '그', '저', '이것', '저것', '그것', '수', '것', '등', '및', '제', '저희',
  '좀', '참', '더', '정말', '진짜', '너무', '완전', '근데', '그래서', '그리고', '하지만', '그런데',
  'ㅋㅋ', 'ㅎㅎ', 'ㅠㅠ', 'ㅜㅜ', 'ㅋ', 'ㅎ', 'ㅠ', 'ㅜ',
  '영상', '댓글', '구독', '좋아요' // Project-specific stopwords
]);

/**
 * Analyzes comments to find the top 10 most frequent keywords.
 * @param {string[]} comments - An array of comment strings.
 * @returns {string[]} An array of the top 10 keywords.
 */
export function analyzeTopics(comments) {
  if (!comments || comments.length === 0) {
    return { nouns: [], verbs: [], adjectives: [] };
  }

  // 간단한 형태소 분리: 명사(한글/영어), 동사(한글+다), 형용사(한글+운/은/는/스러운 등)
  const nounCounts = new Map();
  const verbCounts = new Map();
  const adjCounts = new Map();

  comments.forEach(comment => {
    const words = comment.toLowerCase().match(/[a-zA-Z가-힣]+/g) || [];
    words.forEach(word => {
      if (KOREAN_STOPWORDS.has(word) || word.length < 2) return;
      // 명사: 한글/영어, 2글자 이상, 불용어 제외
      if (/^[가-힣]{2,}$/.test(word) || /^[a-zA-Z]{2,}$/.test(word)) {
        nounCounts.set(word, (nounCounts.get(word) || 0) + 1);
      }
      // 동사: '다'로 끝나는 한글
      if (/^[가-힣]{2,}다$/.test(word)) {
        verbCounts.set(word, (verbCounts.get(word) || 0) + 1);
      }
      // 형용사: '운', '은', '는', '스러운' 등으로 끝나는 한글
      if (/^[가-힣]{2,}(운|은|는|스러운)$/.test(word)) {
        adjCounts.set(word, (adjCounts.get(word) || 0) + 1);
      }
    });
  });

  // 빈도순 정렬 후 TOP 10 반환
  const sortedNouns = Array.from(nounCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sortedVerbs = Array.from(verbCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sortedAdjs = Array.from(adjCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return {
    nouns: sortedNouns,
    verbs: sortedVerbs,
    adjectives: sortedAdjs
  };
}

// Basic sentiment dictionaries
const POSITIVE_WORDS = new Set([
  '좋아요', '최고', '감사합니다', '멋져요', '대박', '사랑', '응원', '재밌', '유익', '기대',
  '행복', '추천', '감동', '기쁨', '굿', '짱', '힐링', '감사', '웃음', '즐거움', '최고에요',
  'love', 'great', 'awesome', 'amazing', 'fun', 'happy', 'cool', 'nice', 'perfect', 'wow',
  '😍', '😊', '👍', '👏', '😁', '😃', '😄', '😆', '😎', '🤩', '💯', '🔥', '💖', '💗', '💙', '💚', '💛', '💜', '🧡'
]);
const NEGATIVE_WORDS = new Set([
  '싫어요', '최악', '별로', '실망', '나쁨', '욕', '짜증', '불만', '그닥', '노잼',
  '화남', '화가', '짜증남', '불쾌', '우울', '실망스러움', '실망했어요', '별로에요', '별로임', '별로다',
  'hate', 'bad', 'worst', 'angry', 'sad', 'disappoint', 'boring', 'terrible', 'awful', 'nope',
  '😠', '😡', '😢', '😭', '😞', '😔', '👎', '💔', '🤬', '😣', '😖', '😫', '😩', '😤'
]);
const STRONG_POSITIVE = new Set(['최고', '대박', '감동', '최고에요', 'awesome', 'amazing', 'perfect', '😍', '💯', '🔥']);
const STRONG_NEGATIVE = new Set(['최악', '실망', 'hate', 'worst', 'terrible', 'awful', '😡', '😭', '🤬', '💔']);

/**
 * Analyzes the sentiment of comments based on a word dictionary.
 * @param {string[]} comments - An array of comment strings.
 * @returns {{positive: number, negative: number, neutral: number}} An object with sentiment ratios.
 */

export function analyzeSentiment(comments) {
  if (!comments || comments.length === 0) {
    return { positive: 0, negative: 0, neutral: 1, strongPositive: 0, strongNegative: 0 };
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let strongPositiveCount = 0;
  let strongNegativeCount = 0;
  let neutralCount = 0;
  let totalComments = comments.length;

  comments.forEach(comment => {
    let pos = 0, neg = 0, strongPos = 0, strongNeg = 0;
    const words = comment.toLowerCase().match(/[a-zA-Z가-힣]+|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu) || [];
    words.forEach(word => {
      if (POSITIVE_WORDS.has(word)) pos++;
      if (NEGATIVE_WORDS.has(word)) neg++;
      if (STRONG_POSITIVE.has(word)) strongPos++;
      if (STRONG_NEGATIVE.has(word)) strongNeg++;
    });
    if (pos > neg && pos > 0) positiveCount++;
    else if (neg > pos && neg > 0) negativeCount++;
    else neutralCount++;
    if (strongPos > 0) strongPositiveCount++;
    if (strongNeg > 0) strongNegativeCount++;
  });

  const positive = positiveCount / totalComments;
  const negative = negativeCount / totalComments;
  const neutral = 1 - positive - negative;
  const strongPositive = strongPositiveCount / totalComments;
  const strongNegative = strongNegativeCount / totalComments;

  return {
    positive: parseFloat(positive.toFixed(2)),
    negative: parseFloat(negative.toFixed(2)),
    neutral: parseFloat(Math.max(0, neutral).toFixed(2)),
    strongPositive: parseFloat(strongPositive.toFixed(2)),
    strongNegative: parseFloat(strongNegative.toFixed(2))
  };
}
