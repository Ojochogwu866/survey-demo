import FeedbackSDK from '@product7/feedback-sdk';

const API_URL = 'https://super-fortnight-be.onrender.com/api';
const WORKSPACE = 'daystar';

let currentUser = null;
let feedbackSDK = null;
let messengerWidget = null;
let surveyWidget = null;
let isLoginMode = true;

// ── Button loading helpers ───────────────────────────────────────────────────

function setButtonLoading(btn, loading, text) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="btn-spinner"></span>${text}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

// ── URLs ─────────────────────────────────────────────────────────────────────

function getProduct7BaseUrls() {
  const base = `https://${WORKSPACE}.product7.io`;
  return {
    feedbackUrl:  `${base}/feedback`,
    changelogUrl: `${base}/changelog`,
    helpUrl:      `${base}/help-docs`,
    roadmapUrl:   `${base}/roadmap`,
  };
}

// ── Auth modal ───────────────────────────────────────────────────────────────

function showAuthModal() {
  document.getElementById('authModal').classList.add('active');
}

function hideAuthModal() {
  document.getElementById('authModal').classList.remove('active');
  // Reset password visibility when modal closes
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  passwordInput.type = 'password';
  eyeIcon.innerHTML = EYE_OPEN_PATH;
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;

  document.getElementById('nameGroup').style.display  = isLoginMode ? 'none' : 'block';
  document.getElementById('modalTitle').textContent   = isLoginMode ? 'Sign In' : 'Sign Up';
  document.getElementById('submitBtn').textContent    = isLoginMode ? 'Sign In' : 'Sign Up';
  document.getElementById('switchText').textContent   = isLoginMode ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('switchLink').textContent   = isLoginMode ? 'Sign Up' : 'Sign In';
  document.getElementById('errorMsg').textContent     = '';
}

// ── UI state ─────────────────────────────────────────────────────────────────

function updateUI() {
  document.getElementById('userInfo').textContent   = `Welcome, ${currentUser.name}`;
  document.getElementById('userInfo').style.display = 'block';
  document.getElementById('authBtn').textContent    = 'Logout';
  document.getElementById('authBtn').onclick        = logout;
}

// ── Widgets ──────────────────────────────────────────────────────────────────

function destroySurveyWidget() {
  if (surveyWidget) {
    surveyWidget.destroy();
    surveyWidget = null;
  }
}

function logout() {
  const btn = document.getElementById('authBtn');
  setButtonLoading(btn, true, 'Logging out...');

  // Clear before destroy so SDK can't re-read its own keys during teardown
  localStorage.clear();

  destroySurveyWidget();

  if (messengerWidget) {
    messengerWidget.destroy();
    messengerWidget = null;
  }

  if (feedbackSDK) {
    feedbackSDK.destroy();
    feedbackSDK = null;
  }

  // Clear again in case destroy() wrote anything back synchronously,
  // and once more on next tick for any async writes
  localStorage.clear();
  setTimeout(() => localStorage.clear(), 0);
  currentUser = null;

  document.getElementById('userInfo').style.display = 'none';
  btn.disabled = false;
  btn.textContent = 'Sign In';
  btn.onclick = showAuthModal;
}

// ── Survey ───────────────────────────────────────────────────────────────────

async function checkAndShowActiveSurvey() {
  if (!feedbackSDK || !currentUser) return;

  feedbackSDK.setUserContext(currentUser);

  const surveys = await feedbackSDK.getActiveSurveys({ includeEligibility: true });

  if (!Array.isArray(surveys) || surveys.length === 0) {
    destroySurveyWidget();
    return;
  }

  destroySurveyWidget();

  surveyWidget = await feedbackSDK.showSurveyById(
    surveys[0].id,
    {
      position:     'center',
      respondentId: currentUser.user_id || currentUser.id || null,
      email:        currentUser.email || null,
      onSubmit:     () => destroySurveyWidget(),
      onDismiss:    () => destroySurveyWidget(),
    }
  );
}

// ── SDK init ─────────────────────────────────────────────────────────────────

async function initializeSDK() {
  if (!currentUser || feedbackSDK) return;

  const urls = getProduct7BaseUrls();

  feedbackSDK = FeedbackSDK.create({
    workspace:   WORKSPACE,
    boardId:     WORKSPACE,
    userContext: currentUser,
  });

  await feedbackSDK.init();

  feedbackSDK.setUserContext(currentUser);

  feedbackSDK.on('survey:suppressed', (payload) => {
    console.log('Survey suppressed:', payload);
  });

  messengerWidget = feedbackSDK.createWidget('messenger', {
    position:        'bottom-left',
    theme:           'light',
    teamName:        'Product7 Support',
    welcomeMessage:  'How can we help you today?',
    enableHelp:      true,
    enableChangelog: true,
    feedbackUrl:     urls.feedbackUrl,
    changelogUrl:    urls.changelogUrl,
    helpUrl:         urls.helpUrl,
    roadmapUrl:      urls.roadmapUrl,
  });
  messengerWidget.mount();

  await checkAndShowActiveSurvey();
}

// ── Auth check on load ────────────────────────────────────────────────────────

async function checkAuth() {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  const btn = document.getElementById('authBtn');
  setButtonLoading(btn, true, 'Loading...');

  try {
    const response = await fetch(API_URL + '/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.userContext;
      updateUI();
      await initializeSDK();
    } else {
      localStorage.removeItem('authToken');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  } catch {
    localStorage.removeItem('authToken');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── Password toggle SVG paths ─────────────────────────────────────────────────

const EYE_OPEN_PATH  = `<path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" fill="currentColor"/>`;
const EYE_CLOSED_PATH = `<path d="M228,175a8,8,0,0,1-10.92-3l-19-33.2A123.23,123.23,0,0,1,162,155.46l5.08,34.2a8,8,0,0,1-6.71,9.05A8.56,8.56,0,0,1,159,199a8,8,0,0,1-7.93-6.71l-5-33.65a124.29,124.29,0,0,1-36.06,0l-5,33.65A8,8,0,0,1,97,199a8.56,8.56,0,0,1-1.36-.12,8,8,0,0,1-6.71-9.05l5.08-34.2a123.23,123.23,0,0,1-36.06-16.69L39,172.06a8,8,0,1,1-13.94-7.94L45,132.78A140.62,140.62,0,0,1,29.09,111,8,8,0,0,1,43,103c12.19,18.16,31.1,39,85,39s72.83-20.86,85-39a8,8,0,1,1,13.9,8A140.62,140.62,0,0,1,211,132.78l19.94,32.28A8,8,0,0,1,228,175Z" fill="currentColor"/>`;

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('authBtn').addEventListener('click', showAuthModal);
document.getElementById('switchLink').addEventListener('click', toggleAuthMode);

document.getElementById('authModal').addEventListener('click', (e) => {
  if (e.target.id === 'authModal') hideAuthModal();
});

// Password show/hide toggle
document.getElementById('togglePassword').addEventListener('click', () => {
  const input   = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  eyeIcon.innerHTML = showing ? EYE_OPEN_PATH : EYE_CLOSED_PATH;
  document.getElementById('togglePassword').setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

// Auth form submit
document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email     = document.getElementById('email').value;
  const password  = document.getElementById('password').value;
  const name      = document.getElementById('name').value;
  const errorMsg  = document.getElementById('errorMsg');
  const submitBtn = document.getElementById('submitBtn');

  errorMsg.textContent = '';
  setButtonLoading(submitBtn, true, isLoginMode ? 'Signing in...' : 'Creating account...');

  const endpoint = isLoginMode ? '/login' : '/register';
  const body     = isLoginMode ? { email, password } : { email, password, name };

  try {
    const response = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      errorMsg.textContent = data.error || 'Authentication failed';
      setButtonLoading(submitBtn, false);
      return;
    }

    localStorage.setItem('authToken', data.token);
    currentUser = data.userContext;

    updateUI();
    hideAuthModal();
    await initializeSDK();
  } catch {
    errorMsg.textContent = 'Network error. Please try again.';
    setButtonLoading(submitBtn, false);
  }
});

// Add to cart buttons
document.getElementById('btn-bananas').addEventListener('click', async () => {
  if (!currentUser) { showAuthModal(); return; }
  const btn = document.getElementById('btn-bananas');
  setButtonLoading(btn, true, 'Adding...');
  await new Promise(r => setTimeout(r, 600));
  setButtonLoading(btn, false);
  alert('Organic Bananas added to cart');
});

document.getElementById('btn-apples').addEventListener('click', async () => {
  if (!currentUser) { showAuthModal(); return; }
  const btn = document.getElementById('btn-apples');
  setButtonLoading(btn, true, 'Adding...');
  await new Promise(r => setTimeout(r, 600));
  setButtonLoading(btn, false);
  alert('Crisp Apples added to cart');
});

checkAuth();
