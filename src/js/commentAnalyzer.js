
// 감정 분석을 위한 키워드 세트
const emotionKeywords = {
  joy: ['기쁨', '행복', '즐거움', '신남', '재미', '웃음', 'haha', 'lol', 'lmao', 'happy', 'joy', 'funny', 'love', 'amazing', 'great', 'excellent', 'good', 'nice', 'awesome', 'fantastic', 'wonderful', 'beautiful'],
  sadness: ['슬픔', '우울', '눈물', 'ㅜㅜ', 'ㅠㅠ', 'sad', 'cry', 'depressed', 'unhappy', 'miserable', 'heartbroken'],
  anger: ['분노', '화남', '짜증', '역겨움', '혐오', 'angry', 'mad', 'furious', 'hate', 'annoying', 'disgusting', 'terrible', 'bad', 'awful'],
  surprise: ['놀람', '충격', '헐', '대박', '미쳤다', 'wow', 'omg', 'shocked', 'surprised', 'unbelievable', 'incredible', 'amazing'],
};

/**
 * 댓글 목록을 받아 감정별 댓글 수를 계산하는 함수
 * @param {Array} comments - 유튜브 댓글 객체 배열
 * @returns {Object} - 감정별 댓글 수 { joy, sadness, anger, surprise, neutral }
 */
export function analyzeEmotions(comments) {
  const emotionCounts = {
    joy: 0,
    sadness: 0,
    anger: 0,
    surprise: 0,
  };

  comments.forEach(comment => {
    const commentText = comment.snippet.topLevelComment.snippet.textDisplay.toLowerCase();
    let detectedEmotion = null;

    for (const emotion in emotionKeywords) {
      if (emotionKeywords[emotion].some(keyword => commentText.includes(keyword))) {
        detectedEmotion = emotion;
        break; // 첫 번째로 감지된 감정으로 분류
      }
    }

    if (detectedEmotion) {
      emotionCounts[detectedEmotion]++;
    }
  });

  const emotionalCommentsCount = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
  emotionCounts.neutral = comments.length - emotionalCommentsCount;

  return emotionCounts;
}


const stopWords = ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn', 'ㅋㅋㅋ', 'ㅎㅎㅎ', 'ㅜㅜㅜ', 'ㅠㅠ', 'ㅋㅋ', 'ㅎㅎ', 'ㅜㅜ', '이', '그', '저', '것', '수', '등', '때', '그냥', '정말', '너무', '진짜', '더', '잘', '좀', '제', '왜', '또', '다', '이런', '저런', '그런'];

/**
 * 댓글 목록을 받아 긍정/부정/중립 댓글 수를 계산하는 함수
 * @param {Array} comments - 유튜브 댓글 객체 배열
 * @returns {Object} - { positive, negative, neutral }
 */
export function analyzeComments(comments) {
  let positive = 0;
  let negative = 0;

  comments.forEach(comment => {
    const commentText = comment.snippet.topLevelComment.snippet.textDisplay.toLowerCase();
    
    const hasPositive = positiveKeywords.some(keyword => commentText.includes(keyword));
    const hasNegative = negativeKeywords.some(keyword => commentText.includes(keyword));

    if (hasPositive && !hasNegative) {
      positive++;
    } else if (!hasPositive && hasNegative) {
      negative++;
    }
  });

  return {
    positive,
    negative,
    neutral: comments.length - positive - negative,
  };
}

/**
 * 댓글 목록에서 가장 많이 언급된 상위 10개 토픽을 추출하는 함수
 * @param {Array} comments - 유튜브 댓글 객체 배열
 * @returns {Array} - [ [topic, count], ... ]
 */
export function extractTopics(comments) {
  const wordCounts = {};

  comments.forEach(comment => {
    const text = comment.snippet.topLevelComment.snippet.textDisplay.toLowerCase();
    const words = text.trim().replace(/[\.,!\?"\(\)]/g, '').split(/\s+/);

    words.forEach(word => {
      if (word.length > 1 && !stopWords.includes(word) && isNaN(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}
