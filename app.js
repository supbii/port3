/* app.js
 - 4단계(Place, Mood, Flow, Extras) 라디얼 구현
 - 각 단계마다 option 순서를 'NE, NW, SE, SW' 순으로 배열해서 한 번에 처리
 - 클릭하면 selections 기록 → 다음 단계로 전환 → 마지막 단계 선택 시 selections 콘솔 출력 (필요하면 결과 페이지로 이동)
 - hover images는 사분면(NE/NW/SE/SW)에 맞춰 항상 동일한 4개를 사용 (파일: radialhover1..4)
*/

(function(){
  // 장소별 오디오 파일 경로 매핑
  const PLACE_SOUNDS = {
    'forest': 'radial/forest_sound.mp3',   // 숲속
    'valley': 'radial/valley_sound.mp3',   // 계곡
    'sea': 'radial/sea_sound.mp3',         // 바닷가
    'lawn': 'radial/lawn_sound.mp3'       // 들판
  };

  // 사운드 재생 관련 변수
  let currentSoundAudio = null;
  let selectedPlace = null;
  let soundStartTime = null;
  let volumeFadeInterval = null;
  let currentPlayingPlace = null; // 현재 재생 중인 장소 선택지 (호버용)
  let audioContextUnlocked = false; // 오디오 컨텍스트 활성화 여부
  let silentAudio = null; // 사일런트 오디오 (컨텍스트 활성화용)
  const FADE_DURATION = 30000; // 30초 동안 볼륨 감소
  const INITIAL_VOLUME = 0.5; // 초기 볼륨 (0-1)
  const MIN_VOLUME = 0.05; // 최소 볼륨

  // 오디오 컨텍스트 활성화 (사용자 상호작용 필요)
  function unlockAudioContext() {
    if (audioContextUnlocked) return Promise.resolve();
    
    return new Promise((resolve) => {
      // 실제 오디오 파일 중 하나를 사용하여 오디오 컨텍스트 활성화
      // 첫 번째 오디오 파일을 미리 로드하고 재생/정지하여 컨텍스트 활성화
      try {
        const firstAudioPath = Object.values(PLACE_SOUNDS)[0]; // 첫 번째 오디오 파일
        if (!firstAudioPath) {
          resolve();
          return;
        }
        
        silentAudio = new Audio(firstAudioPath);
        silentAudio.volume = 0; // 무음으로 설정
        silentAudio.loop = false;
        
        // 오디오 로드 완료 후 재생/정지
        silentAudio.addEventListener('loadeddata', () => {
          const playPromise = silentAudio.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              // 즉시 정지 (사일런트 재생으로 컨텍스트만 활성화)
              setTimeout(() => {
                silentAudio.pause();
                silentAudio.currentTime = 0;
                audioContextUnlocked = true;
                console.log('✅ 오디오 컨텍스트 활성화 완료');
                resolve();
              }, 10);
            }).catch((error) => {
              console.warn('⚠️ 오디오 컨텍스트 활성화 실패, 사용자 상호작용 대기:', error);
              // 재생 실패해도 계속 진행 (사용자 상호작용 후 재시도)
              resolve();
            });
          } else {
            resolve();
          }
        }, { once: true });
        
        silentAudio.addEventListener('error', () => {
          console.warn('⚠️ 오디오 파일 로드 실패');
          resolve();
        }, { once: true });
        
        // 오디오 로드 시작
        silentAudio.load();
      } catch (e) {
        console.warn('오디오 컨텍스트 활성화 중 오류:', e);
        resolve();
      }
    });
  }

  // 장소 선택지 호버 시 사운드 재생
  function playPlaceSound(placeValue) {
    // 첫 번째 질문(place)이 아니거나 이미 선택된 경우 무시
    if (stepIndex !== 0 || selectedPlace) return;

    const audioPath = PLACE_SOUNDS[placeValue];
    if (!audioPath) return;

    // 같은 선택지가 이미 재생 중이면 무시
    if (currentPlayingPlace === placeValue && currentSoundAudio && !currentSoundAudio.paused) {
      return;
    }

    // 기존 사운드 완전히 중지
    stopPlaceSoundForHover();

    // 오디오 컨텍스트 활성화 후 재생
    unlockAudioContext().then(() => {
      // 새로운 사운드 재생
      try {
        currentSoundAudio = new Audio(audioPath);
        currentSoundAudio.loop = true;
        currentSoundAudio.volume = INITIAL_VOLUME;
        currentPlayingPlace = placeValue;
        
        // 재생 시도
        const playPromise = currentSoundAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('🎵 호버 사운드 재생:', placeValue);
          }).catch(error => {
            console.warn('사운드 재생 실패:', error);
            // 재생 실패 시 오디오 컨텍스트 재활성화 시도
            audioContextUnlocked = false;
            unlockAudioContext().then(() => {
              // 재시도
              const retryPromise = currentSoundAudio.play();
              if (retryPromise !== undefined) {
                retryPromise.catch(() => {
                  currentSoundAudio = null;
                  currentPlayingPlace = null;
                });
              }
            });
          });
        }
      } catch (e) {
        console.error('사운드 로드 실패:', e);
        currentSoundAudio = null;
        currentPlayingPlace = null;
      }
    });
  }

  // 선택 후 사운드 계속 재생 (시간에 따라 볼륨 감소)
  function continuePlaceSound(placeValue) {
    selectedPlace = placeValue;
    currentPlayingPlace = null; // 호버 상태 해제
    
    const audioPath = PLACE_SOUNDS[placeValue];
    if (!audioPath) return;

    // 기존 호버 사운드 완전히 중지
    if (currentSoundAudio) {
      try {
        currentSoundAudio.pause();
        currentSoundAudio.currentTime = 0;
      } catch (e) {
        console.warn('기존 사운드 정지 중 오류:', e);
      }
      currentSoundAudio = null;
    }

    // 오디오 컨텍스트 활성화 후 재생
    unlockAudioContext().then(() => {
      // 선택 후 사운드 재생 시작
      try {
        currentSoundAudio = new Audio(audioPath);
        currentSoundAudio.loop = true;
        currentSoundAudio.volume = INITIAL_VOLUME;
        
        // 재생 시도
        const playPromise = currentSoundAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('🎵 선택 후 사운드 재생 시작:', placeValue);
            soundStartTime = Date.now();
            startVolumeFade();
          }).catch(error => {
            console.warn('사운드 재생 실패:', error);
            // 재생 실패 시 오디오 컨텍스트 재활성화 시도
            audioContextUnlocked = false;
            unlockAudioContext().then(() => {
              // 재시도
              const retryPromise = currentSoundAudio.play();
              if (retryPromise !== undefined) {
                retryPromise.then(() => {
                  soundStartTime = Date.now();
                  startVolumeFade();
                }).catch(() => {
                  currentSoundAudio = null;
                });
              }
            });
          });
        }
      } catch (e) {
        console.error('사운드 로드 실패:', e);
        currentSoundAudio = null;
      }
    });
  }

  // 볼륨 페이드 아웃 시작
  function startVolumeFade() {
    if (volumeFadeInterval) {
      clearInterval(volumeFadeInterval);
    }

    volumeFadeInterval = setInterval(() => {
      if (!currentSoundAudio) return;

      const elapsed = Date.now() - soundStartTime;
      const progress = Math.min(elapsed / FADE_DURATION, 1);
      
      // 선형 감소: INITIAL_VOLUME에서 MIN_VOLUME까지
      const currentVolume = INITIAL_VOLUME - (INITIAL_VOLUME - MIN_VOLUME) * progress;
      
      try {
        currentSoundAudio.volume = Math.max(MIN_VOLUME, currentVolume);
      } catch (e) {
        console.error('볼륨 설정 실패:', e);
      }

      // 최소 볼륨에 도달하면 인터벌 정리
      if (progress >= 1) {
        clearInterval(volumeFadeInterval);
        volumeFadeInterval = null;
      }
    }, 100); // 100ms마다 볼륨 업데이트
  }

  // 호버용 사운드 정지 (선택 전)
  function stopPlaceSoundForHover() {
    // 선택된 경우가 아니면 호버 사운드만 정지
    if (!selectedPlace && currentSoundAudio) {
      try {
        currentSoundAudio.pause();
        currentSoundAudio.currentTime = 0;
      } catch (e) {
        console.warn('호버 사운드 정지 중 오류:', e);
      }
      currentSoundAudio = null;
      currentPlayingPlace = null;
      console.log('🛑 호버 사운드 정지');
    }
  }

  // 사운드 완전 정지 (선택 후 또는 페이지 이동 시)
  function stopPlaceSound() {
    if (currentSoundAudio) {
      try {
        currentSoundAudio.pause();
        currentSoundAudio.currentTime = 0;
      } catch (e) {
        console.warn('사운드 정지 중 오류:', e);
      }
      currentSoundAudio = null;
    }
    if (volumeFadeInterval) {
      clearInterval(volumeFadeInterval);
      volumeFadeInterval = null;
    }
    currentPlayingPlace = null;
    // selectedPlace와 soundStartTime은 선택된 경우 유지 (continuePlaceSound에서 사용)
    // 완전 정지가 필요한 경우에만 초기화
  }

  // 완전 정지 (결과 페이지 이동 시)
  function stopPlaceSoundCompletely() {
    stopPlaceSound();
    selectedPlace = null;
    soundStartTime = null;
  }

  // Steps data: 각 단계에서 options 배열은 화면의 사분면 순서(NE, NW, SE, SW)로 대응됩니다.
  const steps = [
    {
      id: 'place',
      title: '어디에서 클래식을 만나고 싶나요?',
      hint: '당신이 음악과 함께 머물고 싶은 장소를 선택하세요.',
      options: [
        { value:'lawn', label:'들판', en:'Lawn' },       // NE
        { value:'forest', label:'숲속', en:'Forest' },    // NW
        { value:'valley', label:'계곡', en:'Valley' },    // SE
        { value:'sea', label:'바닷가', en:'Sea' }         // SW
      ]
    },
    {
      id: 'mood',
      title: '어떤 음악의 질감을 느끼고 싶나요?',
      hint: '마음에 드는 선율의 흐름을 고르세요.',
      options: [
        { value:'baroque', label:'정교한 선율', en:'Baroque' },         // NE
        { value:'romantic', label:'강렬한 감정', en:'Romanticism' },   // NW
        { value:'impression', label:'몽환적 음색', en:'Impressionism' },// SE
        { value:'post', label:'자유로운 형식', en:'Postmodernism' }    // SW
      ]
    },
    {
      id: 'flow',
      title: '어떤 방식으로 공연을 즐기고 싶나요?',
      hint: '당신에게 맞는 자세와 태도를 고르세요.',
      options: [
        { value:'recline', label:'편안히 누워', en:'Recline' }, // NE
        { value:'lounge', label:'자유롭게 앉아', en:'Lounge' }, // NW
        { value:'settle', label:'좌석에서 몰입', en:'Settle' }, // SE
        { value:'wander', label:'가볍게 돌아다니며', en:'Wander' } // SW
      ]
    },
    {
      id: 'extras',
      title: '공연의 여운을 어떻게 이어가고 싶은가요?',
      hint: '어떤 포르타토 활동으로 공연을 완성하고 싶은지 고르세요.',
      options: [
        { value:'dialogue', label:'연주자와 소통', en:'Dialogue' },      // NE
        { value:'refresh', label:'다과 시간', en:'Refreshment' },        // NW
        { value:'play', label:'음악 플레이존', en:'Playground' },        // SE
        { value:'fire', label:'불빛 마당', en:'Fireworks' }              // SW
      ]
    }
  ];

  // DOM refs
  const container = document.getElementById('radialContainer');
  const overlay = document.getElementById('overlay');
  const hitsGroup = overlay.querySelector('.hits');

  const imgLine   = document.getElementById('img-line');
  const imgPlate  = document.getElementById('img-plate');
  const imgInner  = document.getElementById('img-inner');
  const imgCenter = document.getElementById('img-center');

  const hoverNE = document.getElementById('hover-ne'); // radialhover1.svg
  const hoverNW = document.getElementById('hover-nw'); // radialhover2.svg
  const hoverSW = document.getElementById('hover-sw'); // radialhover3.svg
  const hoverSE = document.getElementById('hover-se'); // radialhover4.svg

  // innerplate 영역에 표시될 호버 이미지 (centerImage처럼 동작)
  const innerplateHoverImg = document.getElementById('innerplate-hover-img');

  const labelNE = document.getElementById('label-ne');
  const labelNW = document.getElementById('label-nw');
  const labelSE = document.getElementById('label-se');
  const labelSW = document.getElementById('label-sw');

  // 사이드 설명 패널 제거됨 (사용 안 함)
  const sideHint = null;
  const sideHintTitle = null;
  const sideHintDesc = null;

  // 참조 원(점선) + 오버레이 + 포인터
  const refWrap = document.getElementById('refCircleWrap');
  const refOverlay = document.getElementById('refCircleOverlay');
  const refDot = document.getElementById('refCircleDot');
  const refText = document.getElementById('refCircleText');
  const refTextTitle = document.getElementById('refTextTitle');
  const refTextBody = document.getElementById('refTextBody');

  // 라디얼 위에 씌울 색상 오버레이 (mood, flow, extras 호버 시)
  const radialOverlay = document.getElementById('radialOverlay');

  // 선택지별 오버레이 색상 (필요 시 손쉽게 조정 가능)
  const OVERLAY_COLORS = {
    // place
    lawn: '#9BD8A8', forest: '#74C39A', valley: '#A3D9C9', sea: '#8ECFD6',
    // mood
    baroque: '#D3C9A5', romantic: '#E4A6A6', impression: '#B7C9E2', post: '#C0B4E7',
    // flow
    recline: '#B2E2C2', lounge: '#D0E6B3', settle: '#F0D9A8', wander: '#E6C6D1',
    // extras
    dialogue: '#BFE3E0', refresh: '#E2E6B3', play: '#B3DFF2', fire: '#F9C6A1'
  };

  function setRefCircleOverlay(opt, quad){
    if(!refWrap || !refOverlay || !refDot) return;
    // 배경 점선 원은 항상 표시
    refWrap.style.visibility = 'visible';
    // 오버레이 색상 설정
    const color = OVERLAY_COLORS[opt?.value] || '#BFD6CF';
    refOverlay.style.background = color;
    refOverlay.style.opacity = 0.55; // 점선 아래로 은은히 보이도록

    // 사분면에 맞는 각도(라디얼 기준과 동일한 중심 각도) - 시계 방향
    const angleMap = { ne: -45, nw: -135, se: 45, sw: 135 };
    const deg = angleMap[quad] ?? 0;

    // ref 원 중심/반지름 계산 (현재 refWrap의 위치/크기 기준)
    const wrapRect = refWrap.getBoundingClientRect();
    const cx = wrapRect.left + wrapRect.width/2;
    const cy = wrapRect.top + wrapRect.width/2; // 정사각 가정
    const r = wrapRect.width/2; // ref_circle의 원형 라인에 dot의 중앙이 걸치도록

    const rad = (deg * Math.PI) / 180;
    const dotX = cx + Math.cos(rad) * r;
    const dotY = cy + Math.sin(rad) * r;

    // dot 배치 (페이지 고정 좌표 → fixed 컨테이너 기준 좌표로 변환)
    refDot.style.left = (dotX - wrapRect.left) + 'px';
    refDot.style.top  = (dotY - wrapRect.top) + 'px';
    refDot.style.opacity = 1;
  }

  function clearRefCircle(){
    if(!refWrap || !refOverlay || !refDot) return;
    refOverlay.style.opacity = 0;
    refDot.style.opacity = 0;
    refWrap.style.visibility = 'hidden';
    if (refText) refText.style.opacity = 0;
  }

  // 라디얼 위에 색상 오버레이 표시 (모든 단계 호버 시)
  function showRadialOverlay(opt){
    if(!radialOverlay || !opt) return;
    const color = OVERLAY_COLORS[opt?.value] || '#BFD6CF';
    radialOverlay.style.background = color;
    radialOverlay.style.opacity = 0.4; // 은은하게
    // 라디얼 이미지 크기에 맞춰 오버레이 크기 설정
    if(imgPlate){
      const plateRect = imgPlate.getBoundingClientRect();
      radialOverlay.style.width = plateRect.width + 'px';
      radialOverlay.style.height = plateRect.height + 'px';
    }
  }

  // 라디얼 위 색상 오버레이 숨기기
  function hideRadialOverlay(){
    if(!radialOverlay) return;
    radialOverlay.style.opacity = 0;
  }

  // 참조 원 위치/크기를 라디얼 plate.svg와 동일하게 설정하고, 좌/우 배치
  function positionRefCircle(quad){
    if(!refWrap || !imgPlate) return;
    const plateRect = imgPlate.getBoundingClientRect();
    // plate와 동일한 크기
    const sizePx = Math.round(plateRect.width);
    refWrap.style.width = sizePx + 'px';
    refWrap.style.height = sizePx + 'px';
    // 라디얼과 수평축 정렬 (세로 가운데 일치)
    const topPx = Math.round(plateRect.top + plateRect.height/2 - sizePx/2);
    // 좌/우 배치: 라디얼과 겹치도록 강하게 당김 (중첩)
    const overlapPx = Math.round(sizePx * 0.50); // 겹치는 양: 지름의 50%
    let leftPx;
    if (quad === 'ne' || quad === 'se') {
      // 오른쪽 사분면 → 원을 왼쪽으로 끌어 라디얼과 겹치게
      leftPx = Math.round(plateRect.right - overlapPx);
    } else {
      // 왼쪽 사분면 → 원을 오른쪽으로 끌어 라디얼과 겹치게
      leftPx = Math.round(plateRect.left - sizePx + overlapPx);
    }
    // fixed 포지션 적용
    refWrap.style.position = 'fixed';
    refWrap.style.left = leftPx + 'px';
    refWrap.style.top  = topPx + 'px';
  }

  // ============================================================================
  // 호버 설명 텍스트 수정 영역
  // ============================================================================
  // 이 부분에서 라디얼 페이지 호버 시 나타나는 설명 텍스트를 수정할 수 있습니다.
  // 
  // 구조 설명:
  // - t: 제목 (title) - 첫 번째 줄에 표시되는 텍스트
  // - b: 본문 (body) - 두 번째 줄 이후에 표시되는 텍스트 (줄바꿈은 \n 사용)
  //
  // 예시:
  //   lawn: { t: '들판에서, In Lawn.', b: '첫줄\n두번째줄' }
  // ============================================================================
  
  const TEXT_CONTENT = {
    // [질문 1] 장소 선택 - 어디에서 클래식을 만나고 싶나요?
    place: {
      lawn: { t: '잔디밭에서, Lawn.', b: '부드러운 바람이 스치는 넓은 잔디 위,\n자연과 호흡을 맞추며 여유로운 선율을 즐깁니다.' },
      forest: { t: '휴양림, Forest.', b: '햇살이 나뭇잎 사이로 스며드는 그늘 아래,\n잔잔한 소리와 함께 음악이 자연에 녹아듭니다.' },
      valley: { t: '골짜기, Valley.', b: '맑은 물소리와 서늘한 공기가 어우러진 자리,\n소리는 물결처럼 부드럽게 퍼져갑니다.' },
      sea: { t: '해변무대, Sea.', b: '탁 트인 수평선과 파도 소리가 배경이 되는 무대,\n바람이 선율을 실어 나릅니다.' }
    },
    
    // [질문 2] 음악의 무드 - 어떤 음악을 선호하나요?
    mood: {
      baroque: { t: '바로크 사조, Baroque.', b: '질서와 구조미가 돋보이는 음악으로,\n대위법과 균형미로 완성된 형식미가 돋보입니다.' },
      romantic: { t: '낭만주의, Romanticism.', b: '감정의 폭발과 개성의 음악으로,\n사람의 내면과 열정을 음악으로 드러냅니다.' },
      impression: { t: '인상주의, Impressionism.', b: '빛과 색의 흐름을 담은 듯한 음악으로,\n명확한 형태보다 여운과 분위기로 감정을 전합니다.' },
      post: { t: '포스트모던, Postmodernism.', b: '형식을 허물고 새로운 조합을 시도한 음악으로,\n자유로운 해석을 가능하게 합니다.' }
    },
    
    // [질문 3] 태도/자세 - 어떤 방식으로 감상하고 싶나요?
    flow: {
      recline: { t: '매트, Recline.', b: '쿠션이나 매트에 몸을 기대어 감상합니다.\n몸의 불편을 줄여 편안히 사운드에 집중합니다.' },
      lounge: { t: '방석, Lounge.', b: '방석이나 간이 쇼파에 앉아 감상합니다.\n각자의 방식으로 공연을 맞이하며 다양성을 포용합니다.' },
      settle: { t: '객석, Settle.', b: '좌석형 무대에서 집중해 몰입합니다.\n음악의 세밀한 뉘앙스를 온전히 보고 느낄 수 있습니다.' },
      wander: { t: '산책, Wander.', b: '자유롭게 이동하며 다른 각도와 거리에서 공연을 즐깁니다.\n공간을 탐색하며 유연하게 선율을 관람합니다.' }
    },
    
    // [질문 4] 추가 활동 - 어떤 활동을 하고 싶나요?
    extras: {
      dialogue: { t: '대담시간, Dialogue.', b: '연주자와 관람자가 서로의 여운과 경험을 나눕니다.\n관객은 단순한 청자가 아닌 참여자로서 공연을 만들어갑니다.' },
      refresh: { t: '지역먹거리, Refreshment.', b: '공연 인근 식당이나 베이커리와 협업한 먹거리를 즐깁니다.\n지역의 맛을 통해 공연의 여운을 이어갑니다.' },
      play: { t: '체험부스, Playground.', b: '악기를 해보거나 사운드 워크숍에 참여합니다.\n클래식과 공연곡에 대한 흥미와 이해를 높입니다.' },
      fire: { t: '불꽃행사, Fireworks.', b: '불꽃놀이나 캠프파이어로 공연의 하루를 마무리합니다.\n따뜻한 불빛 속에서 하루의 여운을 함께 나눕니다.' }
    }
  };

  function showRefText(opt){
    if(!refText || !refTextTitle || !refTextBody) return;
    const stepId = steps[stepIndex]?.id;
    const key = opt?.value;
    const entry = TEXT_CONTENT[stepId]?.[key];
    if(!entry) { refText.style.opacity = 0; return; }
    refTextTitle.textContent = entry.t;
    refTextBody.textContent = entry.b;
    refText.style.opacity = 1;
  }

  // 상/하 사분면에 따라 텍스트 위치(상단/하단) 정렬, 좌/우 사분면에 따라 정렬 방향 반전
  // 오버랩 구간(50%)을 정확히 계산하여 텍스트 영역 제한
  function positionRefText(quad, opt){
    if(!refText || !refTextTitle || !refTextBody || !refWrap || !imgPlate) return;
    
    // 좌/우 반전: 오른쪽 사분면(NE/SE)은 오른쪽 정렬, 왼쪽 사분면(NW/SW)은 왼쪽 정렬
    const isRightSide = (quad === 'ne' || quad === 'se');
    const alignDir = isRightSide ? 'right' : 'left';
    const alignItemsDir = isRightSide ? 'flex-end' : 'flex-start';
    
    refText.style.alignItems = alignItemsDir;
    refText.style.textAlign = alignDir;
    refTextTitle.style.textAlign = alignDir;
    refTextBody.style.textAlign = alignDir;
    
    // 오버랩 50%를 고려한 텍스트 영역 제한
    // 오버랩되지 않는 반대편에 텍스트 배치
    const overlapRatio = 0.50; // 50% 오버랩
    
    if (isRightSide) {
      // 오른쪽 써클: 오른쪽 반쪽에 텍스트 배치 (오버랩 안 되는 쪽)
      refText.style.width = `${(1 - overlapRatio) * 100}%`;
      refText.style.right = '0%';
      refText.style.left = 'auto';
    } else {
      // 왼쪽 써클: 왼쪽 반쪽에 텍스트 배치 (오버랩 안 되는 쪽)
      refText.style.width = `${(1 - overlapRatio) * 100}%`;
      refText.style.left = '0%';
      refText.style.right = 'auto';
    }
    
    // 써클 경계에서 여백 추가 (텍스트가 써클 내부에 확실히 들어가도록)
    const smallEdgePadding = '1%'; // 반대편 여백 (더 작게 - 텍스트가 길게 보이도록)
    const largeEdgePadding = '20%'; // 주요 여백 (크게)
    // padding 순서: top right bottom left
    
    if (quad === 'ne' || quad === 'nw') {
      // 상단 사분면 → 윗부분에 배치
      refText.style.justifyContent = 'flex-start';
      if (isRightSide) {
        // 오른쪽 써클: 오른쪽 여백 크게, 왼쪽 여백 더 작게
        refText.style.padding = `10% ${largeEdgePadding} 22% ${smallEdgePadding}`;
      } else {
        // 왼쪽 써클: 왼쪽 여백 크게, 오른쪽 여백 더 작게
        refText.style.padding = `10% ${smallEdgePadding} 22% ${largeEdgePadding}`;
      }
    } else {
      // 하단 사분면 → 아랫부분에 배치
      refText.style.justifyContent = 'flex-end';
      if (isRightSide) {
        // 오른쪽 써클: 오른쪽 여백 크게, 왼쪽 여백 더 작게
        refText.style.padding = `22% ${largeEdgePadding} 10% ${smallEdgePadding}`;
        // 우측 하단 제목: "몽환적 음색"(impression)만 더 멀리 이동
        const isImpression = opt?.value === 'impression';
        refTextTitle.style.transform = isImpression ? 'translateX(4.5vw)' : 'translateX(2vw)';
      } else {
        // 왼쪽 써클: 왼쪽 여백 크게, 오른쪽 여백 더 작게
        refText.style.padding = `22% ${smallEdgePadding} 10% ${largeEdgePadding}`;
        // 좌측 하단 제목: "자유로운 형식"(post)만 더 멀리 이동
        const isPost = opt?.value === 'post';
        refTextTitle.style.transform = isPost ? 'translateX(-4.5vw)' : 'translateX(-2vw)';
      }
    }
    
    // 상단 사분면에서는 제목 transform 초기화
    if (quad === 'ne' || quad === 'nw') {
      refTextTitle.style.transform = 'translateX(0)';
    }
  }

  const questionTitle = document.getElementById('question-title');
  const questionSub   = document.getElementById('question-sub');

  let stepIndex = 0;
  const selections = {};

  // 호버 이미지 경로 매핑
  const HOVER_IMAGE_MAP = {
    // 장소 (place)
    'lawn': 'radial/hover_img/place_lawn.svg',
    'forest': 'radial/hover_img/place_forest.svg',
    'valley': 'radial/hover_img/place_valley.svg',
    'sea': 'radial/hover_img/place_sea.svg',
    // 무드 (mood)
    'baroque': 'radial/hover_img/mood_baroque.svg',
    'romantic': 'radial/hover_img/mood_romanticism.svg',
    'impression': 'radial/hover_img/mood_impressionism.svg',
    'post': 'radial/hover_img/mood_postmodernism.svg',
    // 태도 (flow)
    'recline': 'radial/hover_img/way_recline.svg',
    'lounge': 'radial/hover_img/way_lounge.svg',
    'settle': 'radial/hover_img/way_settle.svg',
    'wander': 'radial/hover_img/way_wander.svg',
    // 활동 (extras)
    'dialogue': 'radial/hover_img/with_dialogue.svg',
    'refresh': 'radial/hover_img/with_refreshment.svg',
    'play': 'radial/hover_img/with_playground.svg',
    'fire': 'radial/hover_img/with_fireworks.svg'
  };

  // quadrant mapping (positions + hover image + label element + rotation)
  // angles chosen so labels follow circular arc and face outward as requested
  const quadrants = [
    { key:'ne', angle:-45,  rotate:45,  hover: hoverNE, labelEl: labelNE }, // index 0 -> NE
    { key:'nw', angle:-135, rotate:-45, hover: hoverNW, labelEl: labelNW }, // index 1 -> NW
    { key:'se', angle:45,   rotate:-45, hover: hoverSE, labelEl: labelSE }, // index 2 -> SE
    { key:'sw', angle:135,  rotate:45,  hover: hoverSW, labelEl: labelSW }  // index 3 -> SW
  ];

  // utils: load intrinsic image size
  function loadIntrinsic(el){
    return new Promise(resolve=>{
      if(!el) return resolve({w:100,h:100});
      if(el.complete && el.naturalWidth) return resolve({w:el.naturalWidth,h:el.naturalHeight});
      el.addEventListener('load', function onl(){ el.removeEventListener('load', onl); resolve({w:el.naturalWidth,h:el.naturalHeight}); });
      el.addEventListener('error', function one(){ el.removeEventListener('error', one); resolve({w:200,h:200}); });
    });
  }

  // layout function (sizes images, places overlay, positions labels)
  async function layoutAll(){
    const intr = await Promise.all([
      loadIntrinsic(imgLine), loadIntrinsic(imgPlate), loadIntrinsic(imgInner), loadIntrinsic(imgCenter),
      loadIntrinsic(hoverNE), loadIntrinsic(hoverNW), loadIntrinsic(hoverSE), loadIntrinsic(hoverSW)
    ]);
    const [ln,pl,inr,cn,hNE,hNW,hSE,hSW] = intr;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Make line fill horizontally (user wanted line to fit width) with margin
    const LINE_FILL_RATIO = 0.88;
    let targetLinePx = Math.round(screenW * LINE_FILL_RATIO);

    // scale based on line intrinsic width; cap by height
    let scale = targetLinePx / Math.max(1, ln.w);
    if (ln.h * scale > screenH * 0.92) scale = (screenH * 0.92) / ln.h;
    scale = Math.max(0.01, scale);

    // apply sizes to base images
    const imgs = { line: imgLine, plate: imgPlate, inner: imgInner, center: imgCenter };
    const intrMap = { line: ln, plate: pl, inner: inr, center: cn };
    Object.keys(imgs).forEach(k=>{
      const el = imgs[k], info = intrMap[k];
      if(!el || !info) return;
      el.style.width = Math.round(info.w * scale) + 'px';
      el.style.height = Math.round(info.h * scale) + 'px';
      el.style.left = '50%';
      el.style.top  = '50%';
      el.style.transform = 'translate(-50%,-50%)';
    });

    // hover images same scale & center
    const hoverMap = { ne: hNE, nw: hNW, se: hSE, sw: hSW };
    [{k:'ne',el:hoverNE},{k:'nw',el:hoverNW},{k:'se',el:hoverSE},{k:'sw',el:hoverSW}].forEach(item=>{
      const el = item.el, info = hoverMap[item.k];
      if(!el || !info) return;
      el.style.width = Math.round(info.w * scale * 1.013) + 'px';
      el.style.height = Math.round(info.h * scale * 1.013) + 'px';
      el.style.left = '50%';
      el.style.top  = '50%';
      el.style.transform = 'translate(-50%,-50%)';
      el.classList.remove('is-active');
    });

    // overlay sizing: roughly line's displayed width; viewBox fixed at 800
    const displayedLineW = Math.round(ln.w * scale);
    const overlayPx = Math.min(displayedLineW, Math.round(Math.min(screenW, screenH) * 0.94));
    overlay.style.width = overlayPx + 'px';

    // innerplate-hover-img: innerplate와 정확히 동일한 크기로 설정
    if (innerplateHoverImg) {
      // innerplate 크기와 정확히 동일하게 설정
      innerplateHoverImg.style.width = Math.round(inr.w * scale) + 'px';
      innerplateHoverImg.style.height = Math.round(inr.h * scale) + 'px';
      innerplateHoverImg.style.left = '50%';
      innerplateHoverImg.style.top = '50%';
      innerplateHoverImg.style.transform = 'translate(-50%,-50%)';
    }
    overlay.style.height = overlayPx + 'px';
    overlay.style.left = '50%';
    overlay.style.top  = '50%';
    overlay.style.transform = 'translate(-50%,-50%)';
    overlay.setAttribute('viewBox','0 0 800 800');

    // compute plate/inner bounds to place labels between them
    const plateRect = imgPlate.getBoundingClientRect();
    const innerRect = imgInner.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cx = containerRect.left + containerRect.width/2;
    const cy = containerRect.top  + containerRect.height/2;
    const r_plate = Math.max(plateRect.width, plateRect.height)/2;
    const r_inner = Math.max(innerRect.width, innerRect.height)/2;

    // target radius between inner and plate (factor controls closeness to plate)
    const factor = 0.72;
    const r_target = r_inner + (r_plate - r_inner) * factor;

    // small global vertical adjustment (user asked to move question down; here we may nudge labels slightly)
    const globalYOffset = Math.round(screenH * 0.02); // positive => down; negative => up

    // per-quadrant fine tune (lower quadrants move up slightly)
    const deltaMap = { ne:0, nw:0, se:-Math.round(screenH*0.035), sw:-Math.round(screenH*0.04) };

    // place labels and images according to current step's options mapped to quadrants (index order => NE, NW, SE, SW)
    const step = steps[stepIndex];
    if (!step) return;
    for (let i=0;i<4;i++){
      const q = quadrants[i]; // quadrants order NE,NW,SE,SW
      const opt = step.options[i];
      const el = q.labelEl;
      const angle = q.angle * Math.PI/180;
      const sx = cx + Math.cos(angle) * r_target;
      const sy = cy + Math.sin(angle) * r_target + globalYOffset + (deltaMap[q.key]||0);
      el.style.left = (sx - containerRect.left) + 'px';
      el.style.top  = (sy - containerRect.top) + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${q.rotate}deg)`;
      el.style.zIndex = 1200;
      el.textContent = opt ? opt.label : '';
      el.setAttribute('data-value', opt ? opt.value : '');

      // 중앙 이미지 크기만 설정 (표시는 호버 시에만)
      if (i === 0 && opt) {
        const centerImgEl = document.getElementById('centerImage');
        if (centerImgEl) {
          // 내부 원의 크기에 맞춰 중앙 이미지 크기 설정
          const centerImageSize = r_inner * 2.0; // 내부 원 전체를 채우도록
          centerImgEl.style.width = centerImageSize + 'px';
          centerImgEl.style.height = centerImageSize + 'px';
          // 디폴트로는 숨김 (호버 시에만 표시)
          centerImgEl.style.display = 'none';
        }
      }

    }

    buildHitsForStep(step.options);
  }

  // build overlay hit sectors and wire events for the current step
  function buildHitsForStep(options){
    // overlay viewBox center 400,400; radius smaller than full to sit inside graphic
    const cx = 400, cy = 400;
    const r = Math.floor(400 * 0.82);

    // quadrant arcs in the same order NE,NW,SE,SW mapped to options indices 0..3
    // 모든 사분면을 동일한 크기(90도)로 설정, 각도 재조정
    const sectorDefs = [
      { id:'hit-ne', a0:-Math.PI/2,   a1: 0,           idx:0, quad:'ne' }, // NE: -90도 ~ 0도 (90도)
      { id:'hit-nw', a0: Math.PI,     a1: 3*Math.PI/2, idx:1, quad:'nw' }, // NW: 180도 ~ 270도 (90도)
      { id:'hit-se', a0: 0,           a1: Math.PI/2,   idx:2, quad:'se' }, // SE: 0도 ~ 90도 (90도)
      { id:'hit-sw', a0: Math.PI/2,   a1: Math.PI,     idx:3, quad:'sw' }  // SW: 90도 ~ 180도 (90도)
    ];

    // clear existing
    hitsGroup.innerHTML = '';

    sectorDefs.forEach(def=>{
      // compute arc endpoints in viewBox coords
      const x1 = cx + r*Math.cos(def.a0), y1 = cy + r*Math.sin(def.a0);
      const x2 = cx + r*Math.cos(def.a1), y2 = cy + r*Math.sin(def.a1);
      const large = (Math.abs(def.a1 - def.a0) > Math.PI) ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;

      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', d);
      p.setAttribute('id', def.id);
      p.setAttribute('class', 'hit');
      p.setAttribute('tabindex','0');

      // bind dataset value from options[idx]
      const opt = options[def.idx];
      if (opt) p.dataset.value = opt.value;
      else p.dataset.value = '';

      // hover handlers: show quadrant hover image immediately; clear on out
      p.addEventListener('pointerover', ()=>{
        hideAllHover();
        const q = def.quad;
        getHoverByQuad(q).classList.add('is-active');
        // 중앙 이미지도 표시 (1단계 장소 선택일 때만)
        showCenterImage(opt);
        // innerplate 영역에 선택지별 호버 이미지 표시 (1단계가 아닐 때만)
        showInnerplateHoverImage(opt);
        // 사이드 설명 패널 표시
        // 사이드 설명 제거됨
        // 참조 원 위치/오버레이/점 표시
        positionRefCircle(q);
        setRefCircleOverlay(opt, q);
        showRefText(opt);
        positionRefText(q, opt);
        // 라디얼 위에 색상 오버레이 표시 (mood, flow, extras 호버 시)
        showRadialOverlay(opt);
        // 장소 선택지 호버 시 사운드 재생 (첫 번째 질문일 때만)
        if (stepIndex === 0 && opt && opt.value) {
          playPlaceSound(opt.value);
        }
      });
      p.addEventListener('pointerout', ()=>{
        hideAllHover();
        hideCenterImage();
        hideInnerplateHoverImage();
        hideSideHint();
        clearRefCircle();
        hideRadialOverlay();
        // 장소 선택지 호버 해제 시 사운드 정지 (선택 전에만)
        if (stepIndex === 0 && !selectedPlace) {
          stopPlaceSoundForHover();
        }
      });
      p.addEventListener('focus', ()=>{
        hideAllHover();
        getHoverByQuad(def.quad).classList.add('is-active');
        showCenterImage(opt);
        showInnerplateHoverImage(opt);
        // 사이드 설명 제거됨
        positionRefCircle(def.quad);
        setRefCircleOverlay(opt, def.quad);
        showRefText(opt);
        positionRefText(def.quad, opt);
        // 라디얼 위에 색상 오버레이 표시 (mood, flow, extras 호버 시)
        showRadialOverlay(opt);
      });
      p.addEventListener('blur', ()=>{
        hideAllHover();
        hideCenterImage();
        hideInnerplateHoverImage();
        clearRefCircle();
        if (refText) refText.style.opacity = 0;
        hideRadialOverlay();
        // 키보드 포커스 해제 시 사운드 정지 (선택 전에만)
        if (stepIndex === 0 && !selectedPlace) {
          stopPlaceSoundForHover();
        }
      });

      // click: register selection for current step, move to next
      p.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const val = p.dataset.value;
        if (val) {
          selections[steps[stepIndex].id] = val;
          console.log(`=== ${stepIndex + 1}단계 선택 완료 ===`);
          console.log(`단계 ID: ${steps[stepIndex].id}`);
          console.log(`선택된 값: ${val}`);
          console.log(`현재 selections:`, selections);
          // 장소 선택 시 사운드 계속 재생 (시간에 따라 볼륨 감소)
          if (stepIndex === 0 && opt && opt.value) {
            continuePlaceSound(opt.value);
          }
        }
        // advance step
        if (stepIndex < steps.length - 1) {
          stepIndex++;
          renderStep();
        } else {
          // last step selected -> go to instrument selection
          console.log('4단계 완료, 악기 선택으로 이동');
          showInstrumentSelection();
        }
      });

      // keyboard activation
      p.addEventListener('keydown', (ev)=>{
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); p.click(); }
      });

      hitsGroup.appendChild(p);
    });

    // ensure leaving overlay clears hover
    overlay.addEventListener('pointerleave', ()=> {
      hideAllHover();
      hideCenterImage();
      hideInnerplateHoverImage();
      clearRefCircle();
      hideRadialOverlay();
      // 장소 선택지 호버 해제 시 사운드 정지 (선택 전에만)
      if (stepIndex === 0 && !selectedPlace) {
        stopPlaceSoundForHover();
      }
    });
  }

  function getHoverByQuad(key){
    if (key === 'ne') return hoverNE;
    if (key === 'nw') return hoverNW;
    if (key === 'se') return hoverSE;
    return hoverSW;
  }


  function hideAllHover(){
    [hoverNE, hoverNW, hoverSE, hoverSW].forEach(h=> h && h.classList.remove('is-active'));
  }

  // 사이드 설명 패널 비활성화 (더 이상 사용하지 않음)
  function showSideHint(){ /* noop */ }
  function hideSideHint(){ /* noop */ }

  // 중앙 이미지 표시 (1단계 장소 선택일 때만)
  function showCenterImage(opt) {
    if (stepIndex !== 0 || !opt) return; // 1단계(장소)가 아니면 표시 안 함
    
    const centerImgEl = document.getElementById('centerImage');
    if (!centerImgEl) return;
    
    // 옵션 값에 따라 이미지 경로 설정
    const imageMap = {
      'lawn': 'radial/hover_img/place_lawn.png',    // 잔디밭
      'forest': 'radial/hover_img/place_forest.png',  // 숲속
      'valley': 'radial/hover_img/place_valley.png',  // 계곡
      'sea': 'radial/hover_img/place_sea.png'      // 바닷가
    };
    
    const imgSrc = imageMap[opt.value];
    if (imgSrc) {
      centerImgEl.src = imgSrc;
      centerImgEl.style.display = 'block';
    }
  }

  // 중앙 이미지 숨기기
  function hideCenterImage() {
    const centerImgEl = document.getElementById('centerImage');
    if (centerImgEl) {
      centerImgEl.style.display = 'none';
    }
  }

  // innerplate 영역에 호버 이미지 표시 (장소 질문이 아닐 때만)
  function showInnerplateHoverImage(opt) {
    // 1단계(장소)일 때는 centerImage를 사용하므로 표시하지 않음
    if (stepIndex === 0 || !opt || !innerplateHoverImg) return;
    
    const hoverImgPath = HOVER_IMAGE_MAP[opt.value];
    if (hoverImgPath) {
      innerplateHoverImg.src = hoverImgPath;
      innerplateHoverImg.style.display = 'block';
    }
  }

  // innerplate 영역 호버 이미지 숨기기
  function hideInnerplateHoverImage() {
    if (innerplateHoverImg) {
      innerplateHoverImg.style.display = 'none';
    }
  }

  // 악기 선택 관련 변수
  const instrumentGrid = document.getElementById('instrumentGrid');
  let selectedInstruments = [];
  const maxSelections = 3;
  let isInstrumentMode = false;

  // 악기 선택 화면 표시
  function showInstrumentSelection() {
    isInstrumentMode = true;
    
    // 라디얼 UI 숨기기
    container.style.display = 'none';
    
    // 악기 그리드 표시
    instrumentGrid.style.display = 'grid';
    
    // 질문 텍스트 변경
    questionTitle.textContent = '어떤 악기를 특히 좋아하나요?';
    questionSub.textContent = '3개까지 고를 수 있어요';
    
    // 진행 표시기 업데이트 (5단계)
    updateProgressIndicator(4);
    
    // 이전 버튼 추가
    addBackButton();
    
    // 완료 버튼 추가
    addCompleteButton();
    
    // 악기 선택 이벤트 리스너 추가
    setupInstrumentSelection();
  }

  // 이전 버튼 추가 (악기 선택 화면용)
  function addBackButton() {
    // 기존 이전 버튼 제거
    const existingBack = document.getElementById('btnBackInstrument');
    if(existingBack) existingBack.remove();
    // 1~4단계에서 생성된 이전 버튼이 남아있다면 제거 (중복 방지)
    const residualBack = document.getElementById('btnBack');
    if(residualBack) residualBack.remove();

    const backImg = document.createElement('img');
    backImg.src = 'asset/back-btn.svg';
    backImg.id = 'btnBackInstrument';
    backImg.alt = '이전';
    backImg.style.position = 'absolute';
    backImg.style.left = '0';
    // 서브 질문 아래로 더 내려 배치 (간격 확대)
    backImg.style.setProperty('top', '135%', 'important');
    // 크기 (1~4단계 이전 버튼과 동일 비율로 통일)
    const backW = (window.innerWidth <= 768 ? '10vw' : '5vw');
    backImg.style.setProperty('width', backW, 'important');
    backImg.style.height = 'auto';
    backImg.style.cursor = 'pointer';
    backImg.style.zIndex = '1400';
    backImg.style.pointerEvents = 'auto'; // 부모의 pointer-events: none을 무시
    
    backImg.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('악기 선택 이전 버튼 클릭됨, 현재 stepIndex:', stepIndex);
      
      // 악기 선택 화면에서 나가기
      isInstrumentMode = false;
      container.style.display = 'block';
      instrumentGrid.style.display = 'none';
      
      // 기존 버튼들 제거
      const existingComplete = document.getElementById('btnComplete');
      if(existingComplete) existingComplete.remove();
      if(backImg) backImg.remove();
      
      // 4단계로 돌아가기 (마지막 라디얼 단계)
      stepIndex = 3;
      console.log('4단계로 돌아감, 새로운 stepIndex:', stepIndex);
      renderStep();
    });
    
    const qEl = document.querySelector('.question');
    if (qEl) qEl.appendChild(backImg);
  }

  // 완료 버튼 추가
  function addCompleteButton() {
    // 기존 완료 버튼 제거
    const existingComplete = document.getElementById('btnComplete');
    if(existingComplete) existingComplete.remove();

    const completeImg = document.createElement('img');
    completeImg.src = 'asset/done-btn.svg';
    completeImg.id = 'btnComplete';
    completeImg.alt = '완료';
    completeImg.style.position = 'absolute';
    // 이전 버튼 오른쪽에 배치 (동일한 수직 위치, 동일한 크기)
    const isMobile = window.innerWidth <= 768;
    const backWidth = isMobile ? 10 : 5; // vw
    const gap = isMobile ? 1.5 : 1;      // vw (더 가깝게)
    completeImg.style.left = `calc(${backWidth}vw + ${gap}vw)`;
    completeImg.style.setProperty('top', '135%', 'important');
    completeImg.style.setProperty('width', (isMobile ? '10vw' : '5vw'), 'important');
    completeImg.style.cursor = 'pointer';
    completeImg.style.zIndex = '1400';
    completeImg.style.opacity = '0.5'; // 비활성화 상태
    completeImg.style.pointerEvents = 'auto'; // 부모의 pointer-events: none을 무시
    
    completeImg.addEventListener('click', () => {
      if (selectedInstruments.length > 0) {
        selections.instruments = selectedInstruments;
        console.log('=== app.js 최종 selections 저장 ===');
        console.log('selections 객체:', selections);
        console.log('selections 키들:', Object.keys(selections));
        
        const jsonString = JSON.stringify(selections);
        console.log('저장할 JSON 문자열:', jsonString);
        
        localStorage.setItem('portatoSelections', jsonString);
        
        // 저장 확인
        const saved = localStorage.getItem('portatoSelections');
        console.log('저장 후 확인:', saved);
        
        console.log('result.html로 이동합니다...');
        // 결과 페이지로 이동 전 사운드 완전 정지
        stopPlaceSoundCompletely();
        // 결과 페이지로 이동
        location.href = 'result.html';
      } else {
        console.warn('선택된 악기가 없습니다. 악기를 선택해주세요.');
      }
    });
    
    document.querySelector('.question').appendChild(completeImg);
  }

  // 악기 영문명 -> 한글명 매핑
  const instrumentNameMap = {
    'violin': '바이올린',
    'viola': '비올라',
    'cello': '첼로',
    'bass': '콘트라베이스',
    'clarinet': '클라리넷',
    'flute': '플룻',
    'trumpet': '트럼펫',
    'trombone': '트럼본',
    'horn': '호른'
  };

  // 악기 선택 이벤트 설정
  function setupInstrumentSelection() {
    const instrumentItems = instrumentGrid.querySelectorAll('.instrument-item');
    
    instrumentItems.forEach(item => {
      // 클릭 이벤트
      item.addEventListener('click', () => {
        const instrumentEn = item.dataset.instrument;
        const instrumentKo = instrumentNameMap[instrumentEn] || instrumentEn;
        
        if (item.classList.contains('selected')) {
          // 선택 해제
          item.classList.remove('selected');
          selectedInstruments = selectedInstruments.filter(inst => inst !== instrumentKo);
        } else {
          // 선택
          if (selectedInstruments.length < maxSelections) {
            item.classList.add('selected');
            selectedInstruments.push(instrumentKo);
          } else {
            // 3개 이상 선택 시 추가 클릭 무시 (알림창 제거)
            console.log('최대 선택 개수에 도달했습니다. 추가 선택이 무시됩니다.');
            return;
          }
        }
        
        // 완료 버튼 상태 업데이트
        updateCompleteButton();
        console.log('선택된 악기들:', selectedInstruments);
      });

      // 호버 이벤트는 CSS로 처리하므로 제거
    });
  }

  // 완료 버튼 상태 업데이트
  function updateCompleteButton() {
    const completeImg = document.getElementById('btnComplete');
    if (completeImg) {
      if (selectedInstruments.length > 0) {
        completeImg.style.opacity = '1'; // 활성화
        completeImg.style.cursor = 'pointer';
      } else {
        completeImg.style.opacity = '0.5'; // 비활성화
        completeImg.style.cursor = 'not-allowed';
      }
    }
  }

  // 진행 표시기 업데이트
  function updateProgressIndicator(currentStep) {
    const progressDots = document.querySelectorAll('.progress-dot');
    progressDots.forEach((dot, index) => {
      if (index <= currentStep) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // render step: update question text and relayout
// 질문 컨테이너 아래 이전 버튼 이미지 추가
function renderStep() {
  const step = steps[stepIndex];
  questionTitle.textContent = step.title;
  questionSub.textContent = step.hint || '';

  // 진행 표시기 업데이트
  updateProgressIndicator(stepIndex);

  // 기존 back 이미지 제거
  const existingBack = document.getElementById('btnBack');
  if(existingBack) existingBack.remove();

  if(stepIndex > 0){
    const backImg = document.createElement('img');
    backImg.src = 'asset/back-btn.svg';
    backImg.id = 'btnBack';
    backImg.alt = '이전';
    backImg.style.position = 'absolute';
    backImg.style.left = '0';
    // 간섭 방지를 위해 !important로 강제 적용
    backImg.style.setProperty('top', '135%', 'important');
    backImg.style.setProperty('width', (window.innerWidth <= 768 ? '10vw' : '5vw'), 'important');
    backImg.style.cursor = 'pointer';
    backImg.style.zIndex = '1400';
    backImg.style.pointerEvents = 'auto'; // 부모의 pointer-events: none을 무시
    
    backImg.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('이전 버튼 클릭됨, 현재 stepIndex:', stepIndex);
      
      // 이전 단계로 이동
      if (stepIndex > 0) {
        stepIndex--;
        console.log('이전 단계로 이동, 새로운 stepIndex:', stepIndex);
        renderStep();
      }
    });
    
    document.querySelector('.question').appendChild(backImg);
  }

  layoutAll();
}

  // 사용자 상호작용 이벤트로 오디오 컨텍스트 활성화
  const unlockAudioOnInteraction = () => {
    if (!audioContextUnlocked) {
      unlockAudioContext();
    }
  };

  // 모든 사용자 상호작용 이벤트에서 오디오 컨텍스트 활성화 시도
  const interactionEvents = ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'click', 'keydown', 'pointerdown', 'pointerup', 'pointermove'];
  interactionEvents.forEach(eventType => {
    document.addEventListener(eventType, unlockAudioOnInteraction, { once: true, passive: true });
  });
  
  // 포인터 이벤트도 추가 (호버 시 즉시 활성화)
  document.addEventListener('pointerover', unlockAudioOnInteraction, { once: true, passive: true });

  // initial render + responsive
  window.addEventListener('load', ()=> { renderStep(); });
  window.addEventListener('resize', debounce(()=> layoutAll(), 120));
  
  // 페이지를 떠날 때 사운드 완전 정지
  window.addEventListener('beforeunload', () => {
    stopPlaceSoundCompletely();
  });

  // small helper
  function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, arguments), wait); }; }
})();
