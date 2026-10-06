/* =============================================================
   ui.js —— 现代 UI 组件层（Bootstrap 5）
   -------------------------------------------------------------
   职责（不触碰绘图内核 ViewGen.js 与算法层 LogicParser.js）：
     1. 用 addEventListener 绑定交互，替代 index.html 里的内联 onclick；
     2. 深色 / 浅色主题切换：localStorage 记忆 + 跟随系统偏好，
        并同步重绘 JointJS 画布与迷你地图的底色；
     3. 示例表达式下拉菜单：点一下即填入并直接出图；
     4. 状态提示：监听 #status 变化 → 底部状态徽标 + Bootstrap Toast；
     5. 元素名称速填 chips：替代原项目对 select2 的调用（原来那个
        #sheet3 元素并不存在，select2 实际上从未生效）。
   ============================================================= */
(function () {
    'use strict';

    if (typeof app === 'undefined') {
        console.error('[ui.js] 未找到 app，请确认 ViewGen.js 已成功加载。');
        return;
    }

    var doc = document;
    var html = doc.documentElement;
    var THEME_KEY = 'logicsim-theme';

    function $(id) { return doc.getElementById(id); }
    function valueOf(id) { var el = $(id); return el ? el.value : ''; }

    /* ---------------- 1. 主题切换 ---------------- */

    var themeToggle = $('themeToggle');
    var themeLabel = $('themeLabel');

    function paperColors(dark) {
        return dark
            ? { canvas: 'rgba(49, 208, 198, 0.08)', mini: 'rgba(49, 208, 198, 0.12)' }
            : { canvas: 'rgba(150, 250, 200, 0.30)', mini: 'rgba(150, 250, 200, 0.30)' };
    }

    function syncPaperTheme() {
        var dark = html.getAttribute('data-bs-theme') === 'dark';
        var colors = paperColors(dark);
        try {
            if (typeof paper !== 'undefined' && paper.drawBackground) {
                paper.drawBackground({ color: colors.canvas });
            }
            if (typeof miniPaperJ !== 'undefined' && miniPaperJ.drawBackground) {
                miniPaperJ.drawBackground({ color: colors.mini });
            }
        } catch (e) {
            /* 画布尚未初始化时忽略 */
        }
    }

    function applyTheme(theme, persist) {
        html.setAttribute('data-bs-theme', theme);
        if (themeLabel) themeLabel.textContent = theme === 'dark' ? '浅色' : '深色';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
        if (persist) {
            try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式忽略 */ }
        }
        syncPaperTheme();
    }

    var initialTheme;
    try { initialTheme = localStorage.getItem(THEME_KEY); } catch (e) { initialTheme = null; }
    if (initialTheme !== 'dark' && initialTheme !== 'light') {
        initialTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? 'dark' : 'light';
    }
    applyTheme(initialTheme, false);

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            applyTheme(html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark', true);
        });
    }

    /* ---------------- 2. 按钮事件绑定 ---------------- */

    function onClick(id, handler) {
        var el = $(id);
        if (el) el.addEventListener('click', handler);
    }

    onClick('parseBtn', function () { app.parseLogic(); });
    onClick('loadBtn', function () { app.load(); });
    onClick('saveBtn', function () { app.save(); });
    onClick('nameBtn', function () { app.ChangeName(); });
    onClick('saveTextBtn', function () { app.saveTextAsFile(); });

    /* ---------------- 3. 示例表达式 ---------------- */

    var PRESETS = [
        { expr: 'a b . fe >', desc: 'a 与 b 推出 fe（原项目示例）' },
        { expr: 'a b . fe ge > =', desc: 'a 与 b 等价于 fe 推出 ge（原项目示例）' },
        { expr: 'a b =', desc: 'a 与 b 等价 / 同或' },
        { expr: 'a b , a c , .', desc: '分配律：(a∨b) ∧ (a∨c)' },
        { expr: 'a a < ,', desc: '常量折叠：a ∨ ¬a → 1' },
        { expr: 'a b . a < ,', desc: '吸收律：(a∧b) ∨ ¬a' }
    ];

    var presetMenu = $('presetMenu');
    if (presetMenu) {
        PRESETS.forEach(function (preset) {
            var item = doc.createElement('li');
            var button = doc.createElement('button');
            button.type = 'button';
            button.className = 'dropdown-item';
            button.innerHTML = '<code>' + preset.expr + '</code><br>' +
                '<span class="text-body-secondary small">' + preset.desc + '</span>';
            button.addEventListener('click', function () {
                var box = $('ReversePol');
                if (box) { box.value = preset.expr; box.focus(); }
                app.parseLogic();
                app.load();
            });
            item.appendChild(button);
            presetMenu.appendChild(item);
        });
    }

    /* ---------------- 4. 元素名称速填 chips ---------------- */

    var chipRow = $('elementNames');

    function refreshChips() {
        if (!chipRow) return;
        var model;
        try {
            model = JSON.parse(valueOf('myModel'));
        } catch (e) {
            return; /* 模型不是合法 JSON 时保持原样 */
        }
        if (!model || !Array.isArray(model.nodeArray)) return;

        var names = [];
        model.nodeArray.forEach(function (node) {
            if (node && typeof node.name === 'string' && node.name !== '' && names.indexOf(node.name) === -1) {
                names.push(node.name);
            }
        });

        chipRow.innerHTML = '';
        names.forEach(function (name) {
            var chip = doc.createElement('button');
            chip.type = 'button';
            chip.className = 'chip';
            chip.textContent = name;
            chip.title = '填入「元素名称」输入框';
            chip.addEventListener('click', function () {
                var box = $('ERName');
                if (box) { box.value = name; box.focus(); }
            });
            chipRow.appendChild(chip);
        });
    }

    // 在 app 的解析 / 载入 / 导出之后刷新 chips（不改动 ViewGen.js 内部实现）
    ['parseLogic', 'load', 'save'].forEach(function (name) {
        var original = app[name];
        if (typeof original !== 'function') return;
        app[name] = function () {
            var result = original.apply(this, arguments);
            refreshChips();
            return result;
        };
    });

    var fileInput = $('fileToLoad');
    if (fileInput) {
        fileInput.addEventListener('change', function () { setTimeout(refreshChips, 120); });
    }
    refreshChips();

    /* ---------------- 5. 状态提示：徽标 + Toast ---------------- */

    var statusEl = $('status');
    var statusBadge = $('statusBadge');
    var toastEl = $('statusToast');
    var toastBody = $('statusToastBody');
    var toast = (toastEl && window.bootstrap && bootstrap.Toast)
        ? new bootstrap.Toast(toastEl, { delay: 2800 })
        : null;

    function classify(text, isError) {
        if (isError) return { label: '错误', badge: 'bg-danger', toast: 'text-bg-danger' };
        if (/已载入|Loaded|parsed|Saved|解析|导出/i.test(text)) {
            return { label: '完成', badge: 'bg-success', toast: 'text-bg-success' };
        }
        return { label: '就绪', badge: 'bg-secondary', toast: 'text-bg-secondary' };
    }

    function updateBadge(text, isError) {
        var info = classify(text, isError);
        if (statusBadge) {
            statusBadge.textContent = info.label;
            statusBadge.className = 'status-badge ' + info.badge;
        }
        return info;
    }

    function statusText() { return statusEl ? statusEl.textContent : ''; }
    function statusIsError() {
        return !!(statusEl && (statusEl.style.color === 'red' || /error|错误/i.test(statusText())));
    }

    if (statusEl) {
        // 首屏只更新徽标，不弹提示
        updateBadge(statusText(), statusIsError());

        var lastStatus = statusText();
        var observer = new MutationObserver(function () {
            var text = statusText();
            if (text === lastStatus) return;
            lastStatus = text;
            var isError = statusIsError();
            var info = updateBadge(text, isError);
            if (toast && toastBody) {
                toastEl.className = 'toast align-items-center border-0 ' + info.toast;
                toastBody.textContent = text;
                toast.show();
            }
        });
        observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
    }

    /* ---------------- 6. 面板折叠手柄 ---------------- */

    var grip = $('resizeToggle');
    if (grip) {
        // 阻止事件冒泡到 #app-resize，避免「点击折叠」同时触发「拖动调宽」
        grip.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        grip.addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof app.ResizeBlock === 'function') app.ResizeBlock();
        });
        grip.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (typeof app.ResizeBlock === 'function') app.ResizeBlock();
            }
        });
    }

    /* ---------------- 7. 额外快捷键：Ctrl/Cmd + Enter 解析并出图 ---------------- */

    doc.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            app.parseLogic();
            app.load();
        }
    });

    /* ---------------- 对外暴露（供 ViewGen.js / 调试使用） ---------------- */

    window.LogicSimUI = {
        refreshFromModel: refreshChips,
        applyTheme: function (theme) { applyTheme(theme, true); },
        syncPaperTheme: syncPaperTheme
    };
})();
