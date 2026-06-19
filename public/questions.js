/* ============================================================
 * 배터리아카데미 교육 수요조사 - 설문 문항 스키마 (공유)
 * 이 파일 하나가 설문(index.html)과 분석 대시보드(admin.html)를
 * 동시에 구동합니다. 문항을 바꾸면 양쪽이 함께 반영됩니다.
 * ============================================================ */

/* ★ 기수 목록 — 새 기수가 시작될 때마다 이 목록에 추가하세요.
 *   (가장 위에 최신 기수를 두면 응답자가 고르기 편합니다.)
 *   응답에는 선택한 기수와 제출 연도가 함께 저장되어,
 *   관리자 대시보드에서 기수별·연도별로 비교 분석됩니다. */
window.SURVEY_COHORTS = ["5기", "4기", "3기", "2기", "1기"];

window.SURVEY_META = {
  title: "한국배터리아카데미(남부권교육과정) 교육 수요조사",
  subtitle: "이차전지 분야 교육생 대상 · 응답 소요시간 약 45~60분",
  intro:
    "여러분께 가장 도움이 되는 교육과정·실습환경·취업지원을 설계하기 위한 사전 수요조사입니다. " +
    "정답이 없는 설문이니, 솔직하게 본인의 현재 상태와 바람을 그대로 표시해 주세요. " +
    "응답은 통계 분석 목적으로만 사용되며, 개인을 식별할 수 있는 정보는 수집하지 않습니다.\n\n" +
    "· 이 설문은 기수마다 반복 실시되며, 응답은 기수별·연도별로 누적되어 교육 운영 개선에 활용됩니다.\n" +
    "· 기수는 운영진이 보내드린 전용 링크에 따라 자동으로 구분되니, 받으신 링크 그대로 응답해 주세요.\n" +
    "· 진행 상황은 자동으로 임시 저장되어, 중간에 닫아도 이어서 작성할 수 있습니다.\n" +
    "· 별표(*)가 있는 문항은 꼭 답해 주세요. 나머지는 선택입니다.",
};

/* 5점 척도 공통 라벨 (자가진단/관심도에서 재사용) */
const LEVEL_SCALE = {
  1: "전혀 모름",
  2: "들어본 정도",
  3: "기본은 이해",
  4: "어느 정도 설명 가능",
  5: "자신 있게 설명 가능",
};
const INTEREST_SCALE = {
  1: "관심 없음",
  2: "조금 관심",
  3: "보통",
  4: "관심 많음",
  5: "꼭 배우고 싶음",
};
const NEED_SCALE = {
  1: "전혀 필요 없음",
  2: "별로",
  3: "보통",
  4: "필요함",
  5: "매우 필요함",
};
const IMPORTANCE_SCALE = {
  1: "전혀 안 중요",
  2: "별로",
  3: "보통",
  4: "중요함",
  5: "매우 중요함",
};

window.SURVEY_SCHEMA = [
  /* ───────────────── 섹션 1. 기본 정보 ───────────────── */
  {
    id: "sec_basic",
    title: "1. 기본 정보",
    desc: "응답 결과를 그룹별로 비교 분석하기 위한 기초 정보입니다. (개인 식별 정보 아님)",
    questions: [
      {
        id: "age",
        type: "single",
        title: "연령대",
        required: true,
        options: ["만 19~24세", "만 25~29세", "만 30~34세", "만 35~39세", "만 40세 이상"],
      },
      {
        id: "gender",
        type: "single",
        title: "성별",
        required: true,
        options: ["여성", "남성", "응답하지 않음"],
      },
      {
        id: "region",
        type: "single",
        title: "현재 거주 지역",
        help: "지금 살고 있는(통학할) 지역을 골라 주세요.",
        required: true,
        options: [
          "수도권(서울·경기·인천)",
          "충청권(대전·세종·충북·충남)",
          "호남권(광주·전북·전남)",
          "대구·경북",
          "부산·울산·경남",
          "강원",
          "제주",
        ],
      },
      {
        id: "edu",
        type: "single",
        title: "최종 학력",
        required: true,
        options: ["고등학교 졸업", "전문대 졸업(2~3년제)", "대학교 졸업(4년제)", "대학원 석사 이상", "현재 재학 중"],
      },
      {
        id: "major",
        type: "single",
        title: "전공 계열",
        help: "전공이 여러 개면 가장 가까운 하나를 골라 주세요.",
        required: true,
        options: [
          "화학·화학공학",
          "재료·금속·신소재",
          "전기·전자",
          "기계·자동차",
          "기타 이공계(물리, 환경, 산업공학 등)",
          "비이공계(인문·사회·예체능 등)",
        ],
      },
      {
        id: "status",
        type: "single",
        title: "현재 상황",
        required: true,
        options: [
          "졸업 예정자(곧 졸업)",
          "취업 준비 중(첫 취업)",
          "직무 전환 준비 중(다른 분야 → 이차전지)",
          "재직 중(이직·역량강화 목적)",
          "기타",
        ],
      },
      {
        id: "experience",
        type: "single",
        title: "이차전지 분야 학습·실무 경험",
        help: "가장 가까운 수준 하나를 골라 주세요.",
        required: true,
        options: [
          "전혀 없음 (이번이 처음)",
          "학교 수업에서 일부 들어봄",
          "온라인 강의·도서로 혼자 공부해 봄",
          "관련 프로젝트·공모전·인턴 경험 있음",
          "이차전지 관련 실무(직장) 경험 있음",
        ],
      },
      {
        id: "cert",
        type: "multi",
        title: "보유한 관련 자격증·이수 교육 (있는 것 모두 선택)",
        required: false,
        options: [
          "없음",
          "이차전지 관련 직무교육 이수",
          "화학·위험물 관련 자격",
          "전기·전자 관련 자격",
          "품질·분석 관련 자격",
          "데이터·SW 관련 자격",
          "기타",
        ],
      },
    ],
  },

  /* ───────────────── 섹션 2. 사전 지식·역량 자가진단 ───────────────── */
  {
    id: "sec_competency",
    title: "2. 사전 지식·역량 자가진단",
    desc:
      "지금 시점에서 각 항목을 스스로 얼마나 알고 있는지 표시해 주세요. " +
      "잘 몰라도 괜찮습니다 — 이 결과로 교육 출발 수준을 맞춥니다.",
    questions: [
      {
        id: "comp",
        type: "likert_grid",
        title: "각 항목에 대한 현재 본인의 이해 수준",
        required: true,
        scale: LEVEL_SCALE,
        items: [
          { id: "principle", label: "이차전지 기본 원리(충전·방전 과정)" },
          { id: "structure", label: "셀 · 모듈 · 팩의 구조와 차이" },
          { id: "cathode", label: "양극재(소재 종류·역할)" },
          { id: "anode", label: "음극재(소재 종류·역할)" },
          { id: "elyte", label: "전해질 · 분리막" },
          { id: "process", label: "셀 제조 공정(믹싱·코팅·조립·화성 등)" },
          { id: "quality", label: "품질 · 불량 · 안전(발화·수명 등)" },
          { id: "bms", label: "BMS 및 전기·전자 기초" },
          { id: "analysis", label: "분석·평가 장비와 시험 방법" },
          { id: "data", label: "데이터 분석·SW 도구(엑셀·파이썬 등)" },
        ],
      },
    ],
  },

  /* ───────────────── 섹션 3. 관심 교육 주제 ───────────────── */
  {
    id: "sec_topics",
    title: "3. 관심 교육 주제",
    desc: "어떤 주제를 배우고 싶은지 알려 주세요. 교육과정의 비중을 정하는 데 사용됩니다.",
    questions: [
      {
        id: "topic_interest",
        type: "likert_grid",
        title: "각 주제를 얼마나 배우고 싶은가요?",
        required: true,
        scale: INTEREST_SCALE,
        items: [
          { id: "material", label: "소재 개발(양극·음극·전해질)" },
          { id: "celldesign", label: "셀 설계·엔지니어링" },
          { id: "manufacturing", label: "제조 공정·생산 기술" },
          { id: "equipment", label: "설비·장비 운영" },
          { id: "qc", label: "품질·불량 분석" },
          { id: "safety", label: "안전성·평가 시험" },
          { id: "bms_power", label: "BMS·전력전자·시스템" },
          { id: "nextgen", label: "차세대 전지(전고체 등)" },
          { id: "recycle", label: "재활용·리사이클링" },
          { id: "industry", label: "산업 동향·시장·정책" },
        ],
      },
      {
        id: "topic_top3",
        type: "rank",
        slots: 3,
        title: "그중 가장 우선적으로 배우고 싶은 주제 TOP 3",
        help: "1순위부터 3순위까지 순서대로 골라 주세요.",
        required: true,
        options: [
          "소재 개발(양극·음극·전해질)",
          "셀 설계·엔지니어링",
          "제조 공정·생산 기술",
          "설비·장비 운영",
          "품질·불량 분석",
          "안전성·평가 시험",
          "BMS·전력전자·시스템",
          "차세대 전지(전고체 등)",
          "재활용·리사이클링",
          "산업 동향·시장·정책",
        ],
      },
      {
        id: "level_target",
        type: "single",
        title: "본인에게 맞다고 생각하는 교육 난이도",
        required: true,
        options: [
          "입문 (용어부터 차근차근)",
          "기초 (전반적인 개념 정리)",
          "중급 (실무에 필요한 깊이)",
          "실무 심화 (현업 수준의 전문 내용)",
        ],
      },
    ],
  },

  /* ───────────────── 섹션 4. 교육 방식 선호 ───────────────── */
  {
    id: "sec_method",
    title: "4. 교육 방식 선호",
    desc: "어떤 방식으로 배울 때 가장 효과적인지 알려 주세요.",
    questions: [
      {
        id: "theory_practice",
        type: "slider",
        title: "이론과 실습의 적정 비중",
        help: "막대를 움직여 실습 비중을 정해 주세요. 왼쪽일수록 이론 중심, 오른쪽일수록 실습 중심입니다.",
        required: true,
        min: 0,
        max: 100,
        step: 10,
        default: 50,
        unit: "% 실습",
        minLabel: "이론 100%",
        maxLabel: "실습 100%",
      },
      {
        id: "class_format",
        type: "multi",
        title: "선호하는 학습 활동 (최대 3개 선택)",
        max: 3,
        required: true,
        options: [
          "강의 중심 수업",
          "실습·실험 실무",
          "팀 프로젝트",
          "현장 견학(공장·연구소)",
          "1:1 또는 소그룹 멘토링",
          "사례 스터디·토론",
          "발표·포트폴리오 제작",
        ],
      },
      {
        id: "session_length",
        type: "single",
        title: "1회 수업의 적정 길이",
        required: true,
        options: ["5시간", "6시간", "7시간", "8시간", "상관없음"],
      },
    ],
  },

  /* ───────────────── 섹션 5. 교육 일정·시수 ───────────────── */
  {
    id: "sec_schedule",
    title: "5. 교육 일정·시수",
    desc: "교육을 언제 개설하고 어떤 일정으로 진행하면 좋을지 알려 주세요.",
    questions: [
      {
        id: "avail_months",
        type: "multi",
        title: "교육에 참여할 수 있는 시기를 모두 선택해 주세요 (개설 시기 결정에 활용)",
        help: "참여가 가능한 달을 모두 고르면 됩니다.",
        required: true,
        options: [
          "1월", "2월", "3월", "4월", "5월", "6월",
          "7월", "8월", "9월", "10월", "11월", "12월",
          "시기는 상관없음",
        ],
      },
      {
        id: "weekly_hours",
        type: "single",
        title: "일주일에 교육에 쓸 수 있는 시간",
        help: "전체 교육을 며칠에 걸쳐 들을지가 이 시간에 따라 정해집니다.",
        required: true,
        options: [
          "주 10시간 이하 (저녁·주말 중심)",
          "주 10~20시간",
          "주 20~35시간",
          "주 35시간 이상 (전일제 가능)",
        ],
      },
      {
        id: "schedule_shape",
        type: "single",
        title: "전체 교육을 어떤 형태로 듣고 싶나요?",
        help: "전체 교육을 어떤 일정에 걸쳐 진행하는 게 좋은지 골라 주세요.",
        required: true,
        options: [
          "단기 집중 — 전일제로 약 3~4주",
          "평일 주간 — 약 1~2개월",
          "평일 저녁 중심 — 약 2~3개월",
          "주말 중심 — 약 2~3개월",
        ],
      },
    ],
  },

  /* ───────────────── 섹션 6. 학습 환경·인프라 ───────────────── */
  {
    id: "sec_env",
    title: "6. 학습 환경·인프라",
    desc: "교육이 진행되는 강의장·실습 환경에 대한 의견입니다. (오프라인 집합교육 기준)",
    questions: [
      {
        id: "env_importance",
        type: "likert_grid",
        title: "다음 학습 환경 요소가 본인에게 얼마나 중요한가요?",
        required: true,
        scale: IMPORTANCE_SCALE,
        items: [
          { id: "equipment", label: "최신 실습 장비·시설" },
          { id: "kit", label: "1인 1실습(개인 실습 키트·장비)" },
          { id: "smallclass", label: "소규모 분반(적은 인원)" },
          { id: "space", label: "자습·실습 공간(연습실 등)" },
          { id: "assistant", label: "조교·보조강사의 밀착 지원" },
          { id: "facility", label: "교통·편의시설(주차·식당·휴게공간 등)" },
        ],
      },
      {
        id: "offline_commute",
        type: "single",
        title: "교육장까지 통학(이동) 가능한 시간",
        required: true,
        options: ["30분 이내", "1시간 이내", "1시간 30분 이내", "2시간 이상도 가능"],
      },
      {
        id: "material_format",
        type: "multi",
        title: "선호하는 학습 자료 형태 (최대 3개)",
        max: 3,
        required: true,
        options: ["PDF 슬라이드", "종이 교재", "실습 매뉴얼·워크북", "코드·예제 데이터", "요약 노트·치트시트"],
      },
    ],
  },

  /* ───────────────── 섹션 7. 교통·숙박 지원 ───────────────── */
  {
    id: "sec_logistics",
    title: "7. 교통·숙박 지원",
    desc: "오프라인 교육에 잘 참여하실 수 있도록, 셔틀버스·숙박 지원 수요를 파악하는 항목입니다.",
    questions: [
      {
        id: "commute_burden",
        type: "single",
        title: "교육장까지 매일 오가는 이동 부담은 어느 정도인가요?",
        required: true,
        options: [
          "거의 부담 없음",
          "약간 부담되는 정도",
          "부담되는 편",
          "매우 부담(통학이 큰 걸림돌)",
        ],
      },
      {
        id: "shuttle_need",
        type: "single",
        title: "셔틀버스가 운행된다면 이용하시겠어요?",
        required: true,
        options: [
          "꼭 이용하겠다",
          "이용하고 싶다",
          "상황에 따라 이용",
          "이용 안 함 (자차·대중교통 이용)",
        ],
      },
      {
        id: "shuttle_stop",
        type: "single",
        title: "셔틀버스는 '포항역'과 '포항 시외·고속버스터미널'을 기점으로 운행됩니다. 주로 어디서 타시겠어요?",
        required: true,
        options: [
          "포항역",
          "포항 시외·고속버스터미널",
          "두 곳 모두 이용 가능",
          "두 곳 다 멀어서 추가 정류장이 필요",
          "셔틀버스 이용 안 함",
        ],
      },
      {
        id: "shuttle_extra",
        type: "textarea",
        title: "추가 정류장이 필요하다면, 타고 싶은 위치(동네·지점명)를 적어 주세요.",
        help: "선택 사항입니다. 수요가 많고 기존 동선(포항역~터미널)에 무리가 없는 경우에 한해 1~2곳 추가를 검토합니다.",
        required: false,
        placeholder: "예: 양덕동 행정복지센터 앞, 이동지하상가 정류장 등",
      },
      {
        id: "lodging_need",
        type: "single",
        title: "교육 기간 중 숙소(기숙사 등) 지원이 필요한가요?",
        required: true,
        options: [
          "반드시 필요",
          "있으면 좋겠다",
          "필요 없음 (통학 가능)",
        ],
      },
      {
        id: "lodging_cost",
        type: "single",
        title: "숙박에 개인 부담이 생긴다면, 1회 교육 기준 어느 정도까지 부담할 수 있나요?",
        help: "숙박이 필요 없으면 맨 위를 선택하세요.",
        required: true,
        options: [
          "숙박 지원이 필요 없음",
          "개인 부담은 어렵다 (전액 지원 필요)",
          "1회 교육 기준 5만원까지",
          "1회 교육 기준 10만원까지",
          "1회 교육 기준 15만원까지",
        ],
      },
    ],
  },

  /* ───────────────── 섹션 8. 전문가 멘토링 수요 ───────────────── */
  {
    id: "sec_mentoring",
    title: "8. 취업지원 전문가 멘토링 수요",
    desc:
      "교육과 별도로, 현업 전문가가 1:1 또는 소그룹으로 취업을 도와주는 멘토링 프로그램을 기획하고 있습니다. " +
      "여러분이 어떤 도움을 원하는지 알려 주세요.",
    questions: [
      {
        id: "mentoring_need",
        type: "single",
        title: "이런 전문가 멘토링이 있다면 참여하고 싶나요?",
        required: true,
        options: [
          "매우 참여하고 싶다",
          "참여하고 싶다",
          "보통",
          "별로 참여하고 싶지 않다",
          "참여하지 않겠다",
        ],
      },
      {
        id: "mentoring_topics",
        type: "likert_grid",
        title: "멘토링에서 받고 싶은 도움의 필요도",
        help: "각 항목이 본인에게 얼마나 필요한지 표시해 주세요.",
        required: true,
        scale: NEED_SCALE,
        items: [
          { id: "career_path", label: "직무·진로 방향 상담(나에게 맞는 직무 찾기)" },
          { id: "resume", label: "이력서·자기소개서 첨삭" },
          { id: "portfolio", label: "포트폴리오·프로젝트 경험 정리" },
          { id: "interview", label: "면접 준비·모의면접" },
          { id: "industry_insight", label: "현업 이야기·업계 인사이트" },
          { id: "company_info", label: "지원할 기업·채용 정보 추천" },
          { id: "skill_gap", label: "부족한 역량 진단·학습 로드맵" },
          { id: "network", label: "현직자 네트워킹·인맥 연결" },
        ],
      },
      {
        id: "mentor_type",
        type: "multi",
        title: "어떤 멘토에게 멘토링을 받고 싶나요? (최대 2개)",
        max: 2,
        required: true,
        options: [
          "셀 제조사 현직자(LG엔솔·삼성SDI·SK온 등)",
          "소재·부품·장비사 현직자",
          "연구소·공공기관 연구원",
          "해당 직무 채용 담당자(인사)",
          "취업·커리어 컨설턴트",
          "관계없이 실력 있는 멘토면 OK",
        ],
      },
      {
        id: "mentoring_format",
        type: "single",
        title: "선호하는 멘토링 진행 방식",
        required: true,
        options: [
          "1:1 개별 멘토링",
          "소그룹(3~5명) 멘토링",
          "그룹 특강·세미나 형태",
          "상관없음",
        ],
      },
      {
        id: "mentoring_freq",
        type: "single",
        title: "원하는 멘토링 빈도",
        required: true,
        options: ["주 1회", "격주 1회", "월 1회", "필요할 때 비정기적으로", "1회성 특강이면 충분"],
      },
    ],
  },

  /* ───────────────── 섹션 9. 취업연계 서비스·추가 교육 프로그램 ───────────────── */
  {
    id: "sec_jobsupport",
    title: "9. 취업연계 서비스·추가 교육 프로그램",
    desc: "정규 교육 외에 운영할 취업연계 서비스와 부가 프로그램에 대한 수요를 알려 주세요.",
    questions: [
      {
        id: "jobservice_need",
        type: "likert_grid",
        title: "다음 취업연계 서비스가 본인에게 얼마나 필요한가요?",
        required: true,
        scale: NEED_SCALE,
        items: [
          { id: "jobfair", label: "채용설명회·기업 IR(기업 직접 설명)" },
          { id: "internship", label: "기업 현장실습·인턴십 연계" },
          { id: "matching", label: "채용 추천·기업 매칭" },
          { id: "resume_clinic", label: "이력서·자소서 클리닉(상시)" },
          { id: "mock_interview", label: "모의면접·면접 클리닉" },
          { id: "cert_support", label: "자격증 취득 지원(특강·응시 지원)" },
          { id: "alumni_talk", label: "취업 성공 선배·현직자 특강" },
          { id: "job_alert", label: "채용 공고 알림·정보 제공" },
        ],
      },
      {
        id: "extra_program",
        type: "multi",
        title: "추가로 듣고 싶은 부가 교육 (최대 3개)",
        help: "이차전지 전공 외에, 취업에 도움이 될 만한 교육입니다.",
        max: 3,
        required: true,
        options: [
          "산업안전·환경(EHS) 교육",
          "데이터 분석 기초(엑셀·파이썬)",
          "직무 영어·영어 면접",
          "보고서·기술문서 작성",
          "특허·지식재산 이해",
          "커뮤니케이션·협업 스킬",
          "창업·진로 설계",
          "추가 교육은 필요 없음",
        ],
      },
      {
        id: "jobfair_join",
        type: "single",
        title: "기업 연계 행사(채용설명회·현장견학 등)가 열린다면?",
        required: true,
        options: ["적극 참여하겠다", "가능하면 참여", "내용에 따라", "참여 어려움"],
      },
      {
        id: "special_topic",
        type: "textarea",
        title: "특강으로 꼭 한 번 듣고 싶은 주제나 모셨으면 하는 분이 있다면?",
        help: "선택 사항입니다. (예: 전고체 배터리 연구원 특강, 합격자 면접 후기 등)",
        required: false,
        placeholder: "여기에 자유롭게 작성",
      },
    ],
  },

  /* ───────────────── 섹션 10. 소통·네트워킹 ───────────────── */
  {
    id: "sec_comm",
    title: "10. 소통·네트워킹",
    desc: "교육 기간 동안의 공지·소통 방식과 교육생 간 네트워킹에 대한 의견입니다.",
    questions: [
      {
        id: "notice_channel",
        type: "multi",
        title: "공지·안내를 받고 싶은 방법 (최대 2개)",
        max: 2,
        required: true,
        options: ["카카오톡", "문자(SMS)", "이메일", "전화"],
      },
      {
        id: "networking_need",
        type: "likert_grid",
        title: "다음 네트워킹·소통이 본인에게 얼마나 필요한가요?",
        required: true,
        scale: NEED_SCALE,
        items: [
          { id: "peer", label: "같은 기수 교육생 간 친목·정보 공유" },
          { id: "mentor_net", label: "현직자·멘토와의 네트워킹" },
          { id: "alumni", label: "선배 기수(수료생)와의 교류" },
          { id: "staff", label: "운영진과의 정기 소통·피드백 창구" },
        ],
      },
      {
        id: "community_pref",
        type: "multi",
        title: "교육생 커뮤니티를 운영한다면 선호하는 방식 (모두 선택)",
        required: false,
        options: ["카카오톡 오픈채팅", "네이버 밴드·카페", "디스코드", "오프라인 정기 모임", "별도 커뮤니티는 원치 않음"],
      },
      {
        id: "study_group",
        type: "single",
        title: "교육생끼리 스터디 그룹을 만든다면 참여 의향은?",
        required: true,
        options: ["적극 참여하겠다", "참여하고 싶다", "보통", "참여하지 않겠다"],
      },
      {
        id: "feedback_channel",
        type: "single",
        title: "교육 중 의견·건의를 전달하고 싶은 방법",
        required: true,
        options: ["익명 설문·건의함", "반(기수) 대표를 통해", "운영진에게 직접", "정기 간담회에서", "딱히 필요 없음"],
      },
      {
        id: "accessibility",
        type: "textarea",
        title: "원활한 학습을 위해 운영진이 배려했으면 하는 점이 있나요?",
        help: "선택 사항입니다. 건강·이동·식이 등 편하게 적어 주세요. (예: 휠체어 접근, 채식 식단 등)",
        required: false,
        placeholder: "여기에 자유롭게 작성",
      },
    ],
  },

  /* ───────────────── 섹션 11. 진로·목표·동기 ───────────────── */
  {
    id: "sec_goal",
    title: "11. 진로·목표·동기",
    desc: "마지막 섹션입니다. 교육을 듣는 목적과 바람을 들려주세요.",
    questions: [
      {
        id: "target_job",
        type: "multi",
        title: "목표로 하는 직무 (최대 2개)",
        max: 2,
        required: true,
        options: [
          "연구개발(소재·셀 R&D)",
          "공정·생산기술",
          "품질·신뢰성",
          "설비·장비 엔지니어",
          "안전·환경(EHS)",
          "영업·기획·구매",
          "아직 정하지 못함",
        ],
      },
      {
        id: "target_company",
        type: "single",
        title: "가장 가고 싶은 기업 유형",
        required: true,
        options: [
          "대기업 셀 제조사",
          "소재·부품 기업",
          "장비·설비 기업",
          "스타트업·중소기업",
          "공공기관·연구소",
          "아직 정하지 못함",
        ],
      },
      {
        id: "work_region",
        type: "multi",
        title: "취업을 희망하는 지역 (최대 2개)",
        help: "이차전지 생산시설이 많은 지역을 참고해 골라 주세요.",
        max: 2,
        required: true,
        options: [
          "수도권(서울·경기·인천)",
          "충청권(충북·충남·대전·세종)",
          "대구·경북(포항·구미 등)",
          "전북(새만금 등)·호남권",
          "부산·울산·경남",
          "강원·기타",
          "지역은 상관없음",
        ],
      },
      {
        id: "expected_salary",
        type: "single",
        title: "취업 시 희망하는 연봉 수준 (신입 기준)",
        help: "세전 기준으로 가장 가까운 구간을 골라 주세요.",
        required: true,
        options: [
          "2,800만원 미만",
          "2,800~3,200만원",
          "3,200~3,600만원",
          "3,600~4,000만원",
          "4,000~5,000만원",
          "5,000만원 이상",
          "잘 모르겠음 / 회사 기준에 따름",
        ],
      },
      {
        id: "motivation",
        type: "multi",
        title: "이 교육을 듣는 가장 큰 이유 (최대 2개)",
        max: 2,
        required: true,
        options: [
          "이차전지 분야로 취업하기 위해",
          "다른 분야에서 이직·전환하기 위해",
          "직무 역량을 키우기 위해",
          "자격증·스펙을 쌓기 위해",
          "분야에 대한 관심·호기심",
        ],
      },
      {
        id: "want_most",
        type: "textarea",
        title: "이 교육에서 꼭 한 가지 얻어가고 싶은 것은 무엇인가요?",
        help: "자유롭게 적어 주세요. (예: 셀 공정을 직접 이해해서 면접에서 설명할 수 있게 되기)",
        required: false,
        placeholder: "여기에 자유롭게 작성",
      },
      {
        id: "concern",
        type: "textarea",
        title: "학습에 우려되는 점이나, 운영진에게 바라는 점이 있다면?",
        help: "선택 사항입니다.",
        required: false,
        placeholder: "여기에 자유롭게 작성",
      },
    ],
  },
];
