const USER_ROLES = {
  ADMIN: 0,
  OFFICER: 1,
  DIRECTOR: 2,
  TEACHER: 3,
  STUDENT: 4,
  UT_USER: 5,
  GUEST: 6,
};

// 一般使用者可在線上借用表單 (前端 BorrowRequestView「選擇教室」) 申請的場地。
// 必須與前端選單一致，否則使用者送出後會被「無效的教室代號」擋下。
const VALID_CLASSROOMS = [
  // 博愛校區
  'G312',
  'G313',
  'G314',
  'G315',
  'G316',
  'G501',
  'G508',
  'G509',
  'G516',
  'GMEET1',
  'GMEET2',
  'GMEET3',
  'CCHALL',
  'ADM201',
  // 天母校區
  'C507',
  'C509',
  'C611',
  'C613',
  'C617',
  'D810',
  'INTLHALL',
];

// 場地查詢系統（前端 StatusPage / IntroductionPage）使用的場地代號。
// 管理員依「場地及設備租借表」代為登錄借用時，可選用這些場地。
const VENUE_IDS = [
  // 博愛校區
  'GMEET1',
  'GMEET2',
  'GMEET3',
  'GCOURT',
  'GPOOL',
  'GROOM',
  'GCOMP',
  'CCHALL',
  'CCCOURT',
  'CCTT',
  'CCDANCE',
  'CCGYM',
  'MUSICHALL',
  'CPSTUDIO',
  'CPSTAGE',
  'CLASSROOM',
  'ADM201',
  'BBCOURT',
  'TENNIS',
  'TRACK',
  // 天母校區
  'C507',
  'C509',
  'C611',
  'C613',
  'C617',
  'D810',
  'INTLHALL',
];

module.exports = { USER_ROLES, VALID_CLASSROOMS, VENUE_IDS };
