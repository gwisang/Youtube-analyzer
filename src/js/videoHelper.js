const categoryKeywords = {
  '음악': ['music', 'mv', 'live', 'concert', 'cover', '노래', '음악', '라이브', '콘서트', '커버', '뮤비'],
  '스포츠': ['sports', 'game', 'match', 'highlights', 'football', 'basketball', 'baseball', '스포츠', '경기', '하이라이트', '축구', '농구', '야구'],
  '여행': ['travel', 'trip', 'vlog', 'tour', 'journey', '여행', '브이로그', '투어'],
  '드라마': ['drama', 'series', '드라마', '시리즈'],
  '영화': ['movie', 'film', 'trailer', 'teaser', '영화', '필름', '예고편', '티저'],
};

/**
 * 영상 제목을 기반으로 카테고리를 분류하는 함수
 * @param {string} title - 영상 제목
 * @returns {string} - '음악', '스포츠', '여행', '기타' 중 하나
 */
export function categorizeVideo(title) {
  const lowerCaseTitle = title.toLowerCase();
  for (const category in categoryKeywords) {
    if (categoryKeywords[category].some(keyword => lowerCaseTitle.includes(keyword))) {
      return category;
    }
  }
  return '기타';
}
