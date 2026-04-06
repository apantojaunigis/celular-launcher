var typed = '';
var mode = 'letters'; // 'letters' o 'numbers'
var contacts = [];
var selectedContact = null;
var callTimerInterval = null;
var callSeconds = 0;

// Tiempo que hay que mantener presionada la tecla para confirmar (ms)
var HOLD_TIME = 600;

var holdTimer = null;
var holdStart = 0;
var holdKey = null;
var previewAnimFrame = null;

// ===== RELOJ Y FECHA =====
function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = h + ':' + m;

  var dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  document.getElementById('date-display').textContent =
    dias[now.getDay()] + ' ' + now.getDate() + ' ' + meses[now.getMonth()];
}

function updateBattery() {
  if (navigator.getBattery) {
    navigator.getBattery().then(function(b) {
      document.getElementById('battery').innerHTML = '&#9608; ' + Math.round(b.level * 100) + '%';
    });
  }
}

// ===== MANEJO DE TECLAS CON HOLD =====
function initKeyboard() {
  var keys = document.querySelectorAll('.kb-key');
  keys.forEach(function(key) {
    key.addEventListener('touchstart', function(e) {
      e.preventDefault();
      onKeyDown(key);
    }, { passive: false });

    key.addEventListener('touchend', function(e) {
      e.preventDefault();
      onKeyUp(key);
    });

    key.addEventListener('touchcancel', function(e) {
      onKeyUp(key);
    });

    key.addEventListener('mousedown', function(e) {
      e.preventDefault();
      onKeyDown(key);
    });

    key.addEventListener('mouseup', function(e) {
      onKeyUp(key);
    });

    key.addEventListener('mouseleave', function(e) {
      onKeyUp(key);
    });
  });
}

function onKeyDown(keyEl) {
  var ch = keyEl.getAttribute('data-char');
  if (!ch) return;

  holdKey = keyEl;
  holdStart = Date.now();
  keyEl.classList.add('pressing');

  showPreview(ch);
  startPreviewBar();

  holdTimer = setTimeout(function() {
    confirmKey(ch, keyEl);
  }, HOLD_TIME);
}

function onKeyUp(keyEl) {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (holdKey) {
    holdKey.classList.remove('pressing');
    holdKey = null;
  }
  hidePreview();
  cancelPreviewBar();
}

function confirmKey(ch, keyEl) {
  holdTimer = null;
  vibrate(40);
  playClick();

  keyEl.classList.remove('pressing');
  keyEl.classList.add('confirmed');
  setTimeout(function() { keyEl.classList.remove('confirmed'); }, 200);

  typed += ch;
  updateDisplay();
  searchContacts();
  hidePreview();
}

// ===== PREVIEW DE TECLA =====
function showPreview(ch) {
  var prev = document.getElementById('key-preview');
  document.getElementById('key-preview-char').textContent = ch === ' ' ? '⎵' : ch;
  prev.classList.remove('hidden');
  document.getElementById('key-preview-fill').style.width = '0%';
}

function hidePreview() {
  document.getElementById('key-preview').classList.add('hidden');
}

function startPreviewBar() {
  var fill = document.getElementById('key-preview-fill');
  fill.style.transition = 'none';
  fill.style.width = '0%';

  requestAnimationFrame(function() {
    fill.style.transition = 'width ' + HOLD_TIME + 'ms linear';
    fill.style.width = '100%';
  });
}

function cancelPreviewBar() {
  var fill = document.getElementById('key-preview-fill');
  fill.style.transition = 'none';
  fill.style.width = '0%';
}

// ===== DISPLAY =====
function updateDisplay() {
  document.getElementById('display-text').textContent = typed;
  document.getElementById('cursor-blink').style.display = typed.length > 0 ? 'none' : 'inline';
}

function deleteLast() {
  if (typed.length > 0) {
    typed = typed.slice(0, -1);
    updateDisplay();
    searchContacts();
    vibrate(20);
  }
}

// ===== BUSQUEDA DE CONTACTOS =====
function searchContacts() {
  var container = document.getElementById('search-results');
  container.innerHTML = '';
  selectedContact = null;

  if (typed.trim().length === 0) return;

  var query = typed.trim().toUpperCase();
  var results = contacts.filter(function(c) {
    var words = c.name.toUpperCase().split(/\s+/);
    var matchesName = words.some(function(word) {
      return word.indexOf(query) === 0;
    });
    return matchesName || c.number.replace(/\s/g, '').indexOf(query) === 0;
  });

  results = results.slice(0, 3);

  if (results.length > 0) {
    selectedContact = results[0];
  }

  results.forEach(function(contact, idx) {
    var div = document.createElement('div');
    div.className = 'search-result' + (idx === 0 ? ' selected' : '');
    div.innerHTML =
      '<span class="search-result-name">' + highlightMatch(contact.name, query) + '</span>' +
      '<span class="search-result-number">' + contact.number + '</span>';
    div.onclick = function() {
      selectedContact = contact;
      document.querySelectorAll('.search-result').forEach(function(el) { el.classList.remove('selected'); });
      div.classList.add('selected');
    };
    container.appendChild(div);
  });
}

function highlightMatch(text, query) {
  var idx = text.toUpperCase().indexOf(query);
  if (idx === -1) return text;
  return text.substring(0, idx) +
    '<strong style="color:#80ff80">' + text.substring(idx, idx + query.length) + '</strong>' +
    text.substring(idx + query.length);
}

// ===== LLAMADAS =====
function callSelected() {
  var number = '';
  var name = '';

  if (selectedContact) {
    number = selectedContact.number;
    name = selectedContact.name;
  } else if (mode === 'numbers' && typed.length > 0) {
    number = typed;
    name = '';
  } else {
    vibrate(100);
    return;
  }

  vibrate(50);

  document.getElementById('call-contact-name').textContent = name;
  document.getElementById('call-number').textContent = number;
  document.getElementById('call-status').textContent = 'Llamando...';
  document.getElementById('call-timer').textContent = '00:00';
  document.getElementById('call-screen').classList.remove('hidden');

  callSeconds = 0;
  callTimerInterval = setInterval(function() {
    callSeconds++;
    var mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    var secs = String(callSeconds % 60).padStart(2, '0');
    document.getElementById('call-timer').textContent = mins + ':' + secs;
    if (callSeconds >= 3) {
      document.getElementById('call-status').textContent = 'En llamada';
    }
  }, 1000);

  window.location.href = 'tel:' + number.replace(/\s/g, '');
}

function endCall() {
  clearInterval(callTimerInterval);
  document.getElementById('call-screen').classList.add('hidden');
  typed = '';
  updateDisplay();
  document.getElementById('search-results').innerHTML = '';
  selectedContact = null;
  vibrate(30);
}

// ===== MODO LETRAS / NUMEROS =====
function toggleMode() {
  if (mode === 'letters') {
    mode = 'numbers';
    document.getElementById('keyboard').classList.add('hidden');
    document.getElementById('numpad').classList.remove('hidden');
    document.getElementById('mode-icon').textContent = 'ABC';
    document.getElementById('mode-label').textContent = 'Letras';
  } else {
    mode = 'letters';
    document.getElementById('keyboard').classList.remove('hidden');
    document.getElementById('numpad').classList.add('hidden');
    document.getElementById('mode-icon').textContent = '123';
    document.getElementById('mode-label').textContent = 'Números';
  }
  vibrate(20);
}

// ===== VIBRACION =====
function vibrate(ms) {
  if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// ===== SONIDO DE CLIC =====
var audioCtx = null;
function playClick() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    gain.gain.value = 0.08;
    osc.frequency.value = 1200;
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    setTimeout(function() { osc.stop(); }, 50);
  } catch(e) {}
}

// ===== CONTACTOS (por ahora lista de ejemplo, luego se leen del teléfono) =====
function loadContacts() {
  contacts = [
    { name: 'María García', number: '310 123 4567' },
    { name: 'Juan Pérez', number: '320 987 6543' },
    { name: 'Doctor Ramírez', number: '315 678 1234' },
    { name: 'Ana López', number: '300 555 1234' },
    { name: 'Carlos Muñoz', number: '312 444 5678' },
    { name: 'Emergencias', number: '123' },
    { name: 'Bomberos', number: '119' },
    { name: 'Policía', number: '112' }
  ];
}

// ===== SALIR DEL LAUNCHER =====
(function() {
  var starHold = null;
  document.addEventListener('touchstart', function(e) {
    var target = e.target.closest('[data-char="*"]');
    if (target) {
      starHold = setTimeout(function() {
        vibrate(200);
        if (confirm('¿Salir de Celular?')) {
          try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
              window.Capacitor.Plugins.App.exitApp();
            }
          } catch(ex) {}
        }
      }, 3000);
    }
  });
  document.addEventListener('touchend', function() { clearTimeout(starHold); });
})();

// ===== INICIO =====
updateClock();
updateBattery();
setInterval(updateClock, 10000);
setInterval(updateBattery, 60000);
loadContacts();

document.addEventListener('DOMContentLoaded', function() {
  initKeyboard();
});

if (document.readyState !== 'loading') {
  initKeyboard();
}
