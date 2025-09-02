import './style.css';
import { supabase } from './js/lib/supabaseClient';
import { analyzeEmotions, extractTopics } from './js/commentAnalyzer.js';
import { categorizeVideo } from './js/videoHelper.js';

// ⚠️ 중요: 이 API 키는 데모용이며, 실제 프로덕션에서는 절대 소스 코드에 포함하면 안 됩니다.
// 이 키는 노출되었으므로 사용 후 반드시 비활성화하세요.
const YOUTUBE_API_KEY = 'AIzaSyBZH0RDzhcD__2Ab2TbRfMm9VtNVzVaACE';

// 1. DOM 요소 가져오기
const urlInput = document.getElementById('youtube-url');
const analyzeBtn = document.getElementById('analyze-btn');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
const commentAnalysisResult = document.getElementById('comment-analysis-result');
const historyList = document.getElementById('history-list');

// 탭 관련 DOM 요소
const trendingVideoTab = document.getElementById('trending-video-tab');
const trendingCategoryTab = document.getElementById('trending-category-tab');
const trendingVideoContent = document.getElementById('trending-video-content');
const trendingCategoryContent = document.getElementById('trending-category-content');
const trendingVideoList = document.getElementById('trending-video-list');
const trendingCategoryList = document.getElementById('trending-category-list');

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
    alert('YouTube API에서 데이터를 가져오는 데 실패했습니다.');
    return null;
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
    alert('YouTube에서 댓글을 가져오는 데 실패했습니다.');
    return [];
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
    alert(`데이터 저장 중 오류가 발생했습니다: ${error.message}`);
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
    alert(`기록 조회 중 오류가 발생했습니다: ${error.message}`);
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
    alert(`인기 동영상 조회 중 오류가 발생했습니다: ${error.message}`);
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
    alert(`인기 카테고리 조회 중 오류가 발생했습니다: ${error.message}`);
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
    alert(`기록 삭제 중 오류가 발생했습니다: ${error.message}`);
  }
};

/**
 * 분석 버튼 클릭 이벤트 핸들러
 */
const handleAnalysis = async () => {
  const url = urlInput.value;
  if (!url) {
    alert('유튜브 URL을 입력해주세요.');
    return;
  }

  const videoId = getVideoIdFromUrl(url);
  if (!videoId) {
    alert('유효하지 않은 유튜브 URL입니다.');
    return;
  }

  console.log(`분석 시작: ${url} (Video ID: ${videoId})`);
  resultSection.style.display = 'block';
  resultContent.innerHTML = `<p><strong>URL:</strong> ${url}</p><p>영상 정보를 불러오는 중...</p>`;
  commentAnalysisResult.innerHTML = '<p>모든 댓글을 불러와 분석하는 중입니다. 댓글 수에 따라 시간이 걸릴 수 있습니다...</p>';

  const videoData = await fetchYouTubeVideoData(videoId);

  if (videoData) {
    const category = categorizeVideo(videoData.title);
    const dataToSave = { ...videoData, url, category };
    const savedData = await saveVideoData(dataToSave);

    resultContent.innerHTML = `
      <img src="${videoData.thumbnail_url}" alt="영상 썸네일" style="width:100%; max-width: 480px; border-radius: 8px;" />
      <h3>${videoData.title}</h3>
      <p><strong>URL:</strong> ${url}</p>
      <p><strong>카테고리:</strong> ${category}</p>
      <p><strong>조회수:</strong> ${videoData.views.toLocaleString()}</p>
      <p><strong>좋아요:</strong> ${videoData.likes.toLocaleString()}</p>
    `;

    const comments = await fetchYouTubeComments(videoId);
    if (comments.length > 0) {
      const emotionAnalysis = analyzeEmotions(comments);
      const topTopics = extractTopics(comments);

      let topicsHtml = '<h5>주요 토픽 TOP 10</h5><ol>';
      topTopics.forEach(topic => {
        topicsHtml += `<li>${topic[0]} (${topic[1]}회)</li>`;
      });
      topicsHtml += '</ol>';

      commentAnalysisResult.innerHTML = `
        <h5>댓글 감정 분석 (총 ${comments.length}개)</h5>
        <ul>
          <li>😊 기쁨: ${emotionAnalysis.joy}개</li>
          <li>😥 슬픔: ${emotionAnalysis.sadness}개</li>
          <li>😡 분노: ${emotionAnalysis.anger}개</li>
          <li>😲 놀람: ${emotionAnalysis.surprise}개</li>
          <li>😐 중립: ${emotionAnalysis.neutral}개</li>
        </ul>
        ${topicsHtml}
      `;
    } else {
      commentAnalysisResult.innerHTML = '<p>분석할 댓글이 없거나 댓글을 불러올 수 없습니다.</p>';
    }
    
    if (savedData) {
      await updateHistory();
      await updateTrendingVideoList();
      await updateTrendingCategoryList();
    }

  } else {
    resultContent.innerHTML = '<p>영상 정보를 가져오는 데 실패했습니다. URL을 확인해주세요.</p>';
    commentAnalysisResult.innerHTML = '';
  }
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
 * 삭제 버튼 클릭 이벤트 핸들러 (이벤트 위임)
 * @param {Event} e 
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


// 2. 이벤트 리스너 등록
analyzeBtn.addEventListener('click', handleAnalysis);
historyList.addEventListener('click', handleDeleteClick);
document.querySelector('.tabs').addEventListener('click', handleTabClick);

// 3. 앱 초기화
const init = () => {
  console.log('Youtube Analyzer 앱이 시작되었습니다.');
  updateHistory(); // 초기 기록 로드
  updateTrendingVideoList(); // 인기 동영상 로드
  updateTrendingCategoryList(); // 인기 카테고리 로드
};

init();
