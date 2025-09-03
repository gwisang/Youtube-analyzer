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
    return [];
  }

  const wordCounts = new Map();

  comments.forEach(comment => {
    // Regex to extract Korean/English words, ignoring most punctuation/emojis
    const words = comment.toLowerCase().match(/[a-zA-Z가-힣]+/g) || [];

    words.forEach(word => {
      // Filter out stopwords and single-character words
      if (!KOREAN_STOPWORDS.has(word) && word.length > 1) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });
  });

  // Sort words by frequency
  const sortedWords = Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Return the top 10 keywords
  return sortedWords.slice(0, 10);
}

// Basic sentiment dictionaries
const POSITIVE_WORDS = new Set(['좋아요', '최고', '감사합니다', '멋져요', '대박', '사랑', '응원', '재밌', '유익', '기대']);
const NEGATIVE_WORDS = new Set(['싫어요', '최악', '별로', '실망', '나쁨', '욕', '짜증', '불만', '그닥', '노잼']);

/**
 * Analyzes the sentiment of comments based on a word dictionary.
 * @param {string[]} comments - An array of comment strings.
 * @returns {{positive: number, negative: number, neutral: number}} An object with sentiment ratios.
 */
export function analyzeSentiment(comments) {
  if (!comments || comments.length === 0) {
    return { positive: 0, negative: 0, neutral: 1 };
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let totalWords = 0;

  comments.forEach(comment => {
    const words = comment.toLowerCase().match(/[a-zA-Z가-힣]+/g) || [];
    words.forEach(word => {
      totalWords++;
      if (POSITIVE_WORDS.has(word)) {
        positiveCount++;
      } else if (NEGATIVE_WORDS.has(word)) {
        negativeCount++;
      }
    });
  });

  if (totalWords === 0) {
    return { positive: 0, negative: 0, neutral: 1 };
  }

  const positive = positiveCount / totalWords;
  const negative = negativeCount / totalWords;
  const neutral = 1 - positive - negative;

  return {
    positive: parseFloat(positive.toFixed(2)),
    negative: parseFloat(negative.toFixed(2)),
    neutral: parseFloat(Math.max(0, neutral).toFixed(2)) // Ensure neutral is not negative
  };
}
