import './style.css';
import { supabase } from './js/lib/supabaseClient';
import { analyzeTopics, analyzeSentiment } from './js/textProcessor.js';
import { categorizeVideo } from './js/videoHelper.js';

// ⚠️ 중요: 이 API 키는 데모용이며, 실제 프로덕션에서는 절대 소스 코드에 포함하면 안 됩니다.
// 이 키는 노출되었으므로 사용 후 반드시 비활성화하세요.
const YOUTUBE_API_KEY = 'AIzaSyBZH0RDzhcD__2Ab2TbRfMm9VtNVzVaACE';

// 1. DOM 요소 가져오기
const urlsInput = document.getElementById('youtube-urls');
const analyzeBtn = document.getElementById('analyze-btn');
const resultSection = document.getElementById('result-section');
const multiResultTableBody = document.querySelector('#multi-result-table tbody');
const historyList = document.getElementById('history-list');

// 탭 관련 DOM 요소
const trendingVideoTab = document.getElementById('trending-video-tab');
const trendingCategoryTab = document.getElementById('trending-category-tab');
const trendingVideoContent = document.getElementById('trending-video-content');
const trendingCategoryContent = document.getElementById('trending-category-content');
const trendingVideoList = document.getElementById('trending-video-list');
const trendingCategoryList = document.getElementById('trending-category-list');

// 상세 분석 모달 관련 DOM 요소
const detailModalOverlay = document.getElementById('detail-modal-overlay');
const detailModalCloseBtn = document.querySelector('.modal-close-btn');
const detailVideoInfo = document.getElementById('detail-video-info');
const detailCommentSummary = document.getElementById('detail-comment-summary');
const detailCommentAnalysisResult = document.getElementById('detail-comment-analysis-result');

// 분석 결과를 저장할 배열 (상세 보기를 위해)
const analysisResults = [];

/**
 * 유튜브 URL에서 동영상 ID를 추출하는 함수
 */
const getVideoIdFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * 유튜브 API를 이용해 영상 데이터를 가져오는 함수
 */
const fetchYouTubeVideoData = async (videoId) => {
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${YOUTUBE_API_KEY}`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        title: item.snippet.title,
        views: parseInt(item.statistics.viewCount, 10),
        likes: parseInt(item.statistics.likeCount, 10),
        thumbnail_url: item.snippet.thumbnails.high.url,
      };
    }
    return null;
  } catch (error) {
    console.error('YouTube API 호출 실패:', error);
    return null; // alert 대신 null 반환
  }
};

/**
 * 유튜브 API를 이용해 모든 댓글을 가져오는 함수 (페이지네이션 처리)
 */
const fetchYouTubeComments = async (videoId) => {
  let allComments = [];
  let nextPageToken = '';

  try {
    do {
      const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=100&pageToken=${nextPageToken}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.items) {
        allComments = allComments.concat(data.items);
      }
      
      nextPageToken = data.nextPageToken;

    } while (nextPageToken);

    return allComments;
  } catch (error) {
    console.error('YouTube 댓글 로딩 실패:', error);
    return []; // alert 대신 빈 배열 반환
  }
};

/**
 * 영상 데이터를 Supabase에 저장하는 함수
 */
const saveVideoData = async (videoData) => {
  try {
    const { data, error } = await supabase.from('videos').insert([videoData]).select();
    if (error) throw error;
    console.log('데이터 저장 성공:', data);
    return data[0];
  } catch (error) {
    console.error('데이터 저장 실패:', error);
  }
};

/**
 * Supabase에서 영상 분석 기록을 가져오는 함수
 */
const fetchVideoHistory = async () => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('기록 조회 실패:', error);
  }
};

/**
 * Supabase에서 인기 분석 동영상을 가져오는 함수
 */
const fetchTrendingVideos = async () => {
  try {
    const { data, error } = await supabase.rpc('get_trending_videos');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('인기 동영상 조회 실패:', error);
  }
};

/**
 * Supabase에서 인기 분석 카테고리를 가져오는 함수
 */
const fetchTrendingCategories = async () => {
  try {
    const { data, error } = await supabase.rpc('get_trending_categories');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('인기 카테고리 조회 실패:', error);
  }
};

/**
 * Supabase에서 특정 ID의 영상 기록을 삭제하는 함수
 * @param {number} id
 */
const deleteVideoHistory = async (id) => {
  try {
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) throw error;
    console.log(`${id}번 기록 삭제 성공`);
  } catch (error) {
    console.error('기록 삭제 실패:', error);
  }
};

/**
 * 단일 영상 분석 로직
 * @param {string} url - 분석할 유튜브 URL
 * @returns {object|null} - 분석 결과 객체 또는 실패 시 null
 */
const analyzeSingleVideo = async (url) => {
  const videoId = getVideoIdFromUrl(url);
  if (!videoId) {
    return { title: `<span class="error-text">유효하지 않은 URL: ${url}</span>`, category: '-', likes: '-', dominantEmotion: '-', fullData: null };
  }

  const videoData = await fetchYouTubeVideoData(videoId);
  if (!videoData) {
    return { title: `<span class="error-text">영상 정보 로딩 실패: ${url}</span>`, category: '-', likes: '-', dominantEmotion: '-', fullData: null };
  }

  const category = categorizeVideo(videoData.title);
  const comments = await fetchYouTubeComments(videoId);
  const commentTexts = comments.map(item => item.snippet.topLevelComment.snippet.textDisplay || '');

  let topics = { nouns: [], verbs: [], adjectives: [] };
  let sentiment = { positive: 0, negative: 0, neutral: 1 };
  let dominantEmotion = '중립';

  if (commentTexts.length > 0) {
    // analyzeTopics가 명사/동사/형용사별 TOP 10을 반환하도록 수정 필요
    topics = analyzeTopics(commentTexts); // {nouns: [...], verbs: [...], adjectives: [...]}
    sentiment = analyzeSentiment(commentTexts);

    const sentimentMap = { positive: '긍정', negative: '부정', neutral: '중립' };
    const dominant = Object.keys(sentiment).reduce((a, b) => sentiment[a] > sentiment[b] ? a : b);
    dominantEmotion = sentimentMap[dominant] || '중립';
  }

  const dataToSave = { 
    ...videoData, 
    url, 
    category, 
    topics,
    sentiment: sentiment
  };
  await saveVideoData(dataToSave);

  return {
    title: videoData.title,
    category,
    likes: videoData.likes.toLocaleString(),
    dominantEmotion,
    fullData: { 
      videoInfo: { ...videoData, url, category },
      commentsCount: commentTexts.length,
      topics,
      sentiment,
    }
  };
};

/**
 * 여러 영상 분석을 위한 메인 핸들러
 */
const handleAnalysis = async () => {
  const urlsText = urlsInput.value;
  if (!urlsText.trim()) {
    alert('유튜브 URL을 입력해주세요.');
    return;
  }

  const urls = urlsText.trim().split(/\s+/).filter(url => url);
  if (urls.length === 0) {
    alert('입력된 URL이 없습니다.');
    return;
  }

  resultSection.style.display = 'block';
  multiResultTableBody.innerHTML = ''; // 테이블 초기화
  analysisResults.length = 0; // 이전 분석 결과 초기화

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '분석 중...';

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await analyzeSingleVideo(url);
    analysisResults.push(result.fullData); // 상세 보기를 위해 전체 데이터 저장

      // 감정에 맞는 이모티콘 추가
      let emotionIcon = '😐';
      if (result.dominantEmotion === '긍정') emotionIcon = '😊';
      else if (result.dominantEmotion === '부정') emotionIcon = '😠';
      else if (result.dominantEmotion === '중립') emotionIcon = '😐';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${result.title}</td>
        <td>${result.category}</td>
        <td>${result.likes}</td>
        <td>${emotionIcon} ${result.dominantEmotion}</td>
        <td><button class="detail-btn" data-index="${i}">상세 보기</button></td>
      `;
      multiResultTableBody.appendChild(row);
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '분석하기';

  // 모든 분석 완료 후 기록 및 트렌드 업데이트
  await updateHistory();
  await updateTrendingVideoList();
  await updateTrendingCategoryList();
};


/**
 * 분석 기록을 화면에 표시하는 함수
 */
const updateHistory = async () => {
  const history = await fetchVideoHistory();
  historyList.innerHTML = ''; // 목록 초기화

  if (history && history.length > 0) {
    history.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${item.url}" target="_blank">${item.title || item.url}</a>
        <span>(조회수: ${item.views?.toLocaleString() || 'N/A'})</span>
        <button class="delete-btn" data-id="${item.id}">삭제</button>
      `;
      historyList.appendChild(li);
    });
  } else {
    historyList.innerHTML = '<li>아직 분석 기록이 없습니다.</li>';
  }
}

/**
 * 인기 동영상 목록을 화면에 표시하는 함수
 */
const updateTrendingVideoList = async () => {
  const trending = await fetchTrendingVideos();
  trendingVideoList.innerHTML = ''; // 목록 초기화

  if (trending && trending.length > 0) {
    trending.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${item.url}" target="_blank">${item.title || item.url}</a>
        <span>(분석 ${item.analysis_count}회)</span>
      `;
      trendingVideoList.appendChild(li);
    });
  } else {
    trendingVideoList.innerHTML = '<li>아직 인기 분석 기록이 없습니다.</li>';
  }
};

/**
 * 인기 카테고리 목록을 화면에 표시하는 함수
 */
const updateTrendingCategoryList = async () => {
  const trending = await fetchTrendingCategories();
  trendingCategoryList.innerHTML = ''; // 목록 초기화

  if (trending && trending.length > 0) {
    trending.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${item.category}</strong>
        <span>(분석 ${item.analysis_count}회)</span>
      `;
      trendingCategoryList.appendChild(li);
    });
  } else {
    trendingCategoryList.innerHTML = '<li>아직 인기 카테고리 기록이 없습니다.</li>';
  }
};

/**
 * 상세 분석 모달을 표시하는 함수
 * @param {object} data - 상세 분석 데이터
 */
const showDetailModal = (data) => {
  if (!data || !data.videoInfo) {
    console.error('상세 분석 데이터가 올바르지 않습니다.', data);
    alert('상세 정보를 표시할 수 없습니다.');
    return;
  }

  detailVideoInfo.innerHTML = `
    <img src="${data.videoInfo.thumbnail_url}" alt="영상 썸네일" style="width:100%; max-width: 480px; border-radius: 8px;" />
    <h3>${data.videoInfo.title}</h3>
    <p><strong>URL:</strong> <a href="${data.videoInfo.url}" target="_blank">${data.videoInfo.url}</a></p>
    <p><strong>카테고리:</strong> ${data.videoInfo.category}</p>
    <p><strong>조회수:</strong> ${data.videoInfo.views.toLocaleString()}</p>
    <p><strong>좋아요:</strong> ${data.videoInfo.likes.toLocaleString()}</p>
  `;

  // 댓글 요약은 현재 제공되지 않으므로 비워둡니다.
  detailCommentSummary.innerHTML = '';

  let topicsHtml = '<h5>댓글 토픽 분석 (명사/동사/형용사 TOP 10)</h5>';
  if (data.topics) {
    // 명사
    if (data.topics.nouns && data.topics.nouns.length > 0) {
      topicsHtml += '<strong>명사 TOP 10</strong><ol>';
      data.topics.nouns.forEach(([word, count]) => {
        topicsHtml += `<li>${word} (${count}회)</li>`;
      });
      topicsHtml += '</ol>';
    }
    // 동사
    if (data.topics.verbs && data.topics.verbs.length > 0) {
      topicsHtml += '<strong>동사 TOP 10</strong><ol>';
      data.topics.verbs.forEach(([word, count]) => {
        topicsHtml += `<li>${word} (${count}회)</li>`;
      });
      topicsHtml += '</ol>';
    }
    // 형용사
    if (data.topics.adjectives && data.topics.adjectives.length > 0) {
      topicsHtml += '<strong>형용사 TOP 10</strong><ol>';
      data.topics.adjectives.forEach(([word, count]) => {
        topicsHtml += `<li>${word} (${count}회)</li>`;
      });
      topicsHtml += '</ol>';
    }
    if (
      (!data.topics.nouns || data.topics.nouns.length === 0) &&
      (!data.topics.verbs || data.topics.verbs.length === 0) &&
      (!data.topics.adjectives || data.topics.adjectives.length === 0)
    ) {
      topicsHtml += '<p>분석된 토픽이 없습니다.</p>';
    }
  } else {
    topicsHtml += '<p>분석된 토픽이 없습니다.</p>';
  }

  let sentimentHtml = `<h5>댓글 감정 분석 (총 ${data.commentsCount}개)</h5>`;
  if (data.sentiment) {
    sentimentHtml += `
      <ul style="display:flex; gap:1.5rem; flex-wrap:wrap;">
        <li>😍 ${(data.sentiment.strongPositive * 100).toFixed(1)}% <span style="color:#dc2626;">매우 긍정</span></li>
        <li>😊 ${(data.sentiment.positive * 100).toFixed(1)}% <span style="color:#dc2626;">긍정</span></li>
        <li>😐 ${(data.sentiment.neutral * 100).toFixed(1)}% <span style="color:#dc2626;">중립</span></li>
        <li>😠 ${(data.sentiment.negative * 100).toFixed(1)}% <span style="color:#dc2626;">부정</span></li>
        <li>😭 ${(data.sentiment.strongNegative * 100).toFixed(1)}% <span style="color:#dc2626;">매우 부정</span></li>
      </ul>
    `;
  } else {
    sentimentHtml += '<p>감정 분석 결과가 없습니다.</p>';
  }

  detailCommentAnalysisResult.innerHTML = sentimentHtml + topicsHtml;

  detailModalOverlay.classList.add('active');
};

/**
 * 상세 분석 모달을 숨기는 함수
 */
const hideDetailModal = () => {
  detailModalOverlay.classList.remove('active');
};

/**
 * 삭제 버튼 클릭 이벤트 핸들러 (이벤트 위임)
 */
const handleDeleteClick = async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    if (confirm(`정말로 이 기록을 삭제하시겠습니까?`)) {
      await deleteVideoHistory(id);
      await updateHistory();
      await updateTrendingVideoList();
      await updateTrendingCategoryList();
    }
  }
};

/**
 * 탭 전환 이벤트 핸들러
 */
const handleTabClick = (e) => {
  const target = e.target;
  if (!target.classList.contains('tab-btn')) return;

  // 모든 탭 버튼과 컨텐츠에서 active 클래스 제거
  trendingVideoTab.classList.remove('active');
  trendingCategoryTab.classList.remove('active');
  trendingVideoContent.classList.remove('active');
  trendingCategoryContent.classList.remove('active');

  // 클릭된 탭에 active 클래스 추가
  target.classList.add('active');
  if (target.id === 'trending-video-tab') {
    trendingVideoContent.classList.add('active');
  } else {
    trendingCategoryContent.classList.add('active');
  }
};

/**
 * 상세 보기 버튼 클릭 이벤트 핸들러 (이벤트 위임)
 */
const handleDetailClick = (e) => {
  if (e.target.classList.contains('detail-btn')) {
    const index = parseInt(e.target.dataset.index);
    const data = analysisResults[index];
    if (data) {
      showDetailModal(data);
    }
  }
};

// 2. 이벤트 리스너 등록
analyzeBtn.addEventListener('click', handleAnalysis);
historyList.addEventListener('click', handleDeleteClick);
document.querySelector('.tabs').addEventListener('click', handleTabClick);
multiResultTableBody.addEventListener('click', handleDetailClick); // 상세 보기 버튼 클릭 이벤트
detailModalCloseBtn.addEventListener('click', hideDetailModal); // 모달 닫기 버튼
detailModalOverlay.addEventListener('click', (e) => { // 모달 오버레이 클릭 시 닫기
  if (e.target === detailModalOverlay) {
    hideDetailModal();
  }
});

// 3. 앱 초기화
const init = () => {
  console.log('Youtube Analyzer 앱이 시작되었습니다.');
  updateHistory(); // 초기 기록 로드
  updateTrendingVideoList(); // 인기 동영상 로드
  updateTrendingCategoryList(); // 인기 카테고리 로드
};

init();
