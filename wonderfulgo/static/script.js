document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 定数・変数の定義
    // ==========================================
    const PET_INFO_KEY = 'pet_info';
    const PET_IMAGE_KEY = 'pet_profile_image';
    const PLAN_HISTORY_KEY = 'plan_history_log';
    const CHAT_HISTORY_KEY = 'chat_history_log';
    const PET_FAV_KEY = 'pet_fav_spots'; // ★追加: お気に入り保存用
    
    // DOM要素の取得
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');
    
    const textInputIds = [
        'dog_name', 'breed', 'gender', 'age', 'weight', 'coat_type',
        'neutered_spayed', 'allergies', 'medical_history', 'others',
        'personality', 'barking_tendency', 'biting_habit',
        'walk_frequency_time', 'exercise_level', 'likes_water_play',
        'car_sickness', 'can_stay_alone', 'training_status',
        'owner_residence'
    ];
    const radioNames = ['dog_interaction', 'human_interaction'];

    const profileImageInput = document.getElementById('profile-image-input');
    const profileImagePreview = document.getElementById('profile-image-preview');
    const saveProfileButton = document.getElementById('saveProfileButton');
    const createPlanButton = document.getElementById('createPlanButton');
    const sendMessageButton = document.getElementById('sendMessageButton');
    const chatInput = document.getElementById('chatInput');
    const resetButton = document.getElementById('resetButton');
    const chatDeleteModeBtn = document.getElementById('chatDeleteModeBtn');
    
    const chatMessages = document.getElementById('chatMessages'); 
    const guideResults = document.getElementById('guideResults');
    const favList = document.getElementById('favList'); // ★追加
    const planLoading = document.getElementById('plan-loading');
    const chatLoading = document.getElementById('chat-loading');

    // ==========================================
    // 2. ユーティリティ関数
    // ==========================================
    function compressImage(file, callback) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxSize = 300; 
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                callback(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleString('ja-JP', { 
            month: 'numeric', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ==========================================
    // 3. 画面切り替え & データ読み込み
    // ==========================================
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if(target) target.classList.add('active');

        navItems.forEach(item => {
            item.classList.remove('active');
            if(item.dataset.screen === screenId) item.classList.add('active');
        });

        // ★追加: FAV画面が開かれたらリストを再描画
        if (screenId === 'favScreen') {
            loadFavorites();
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => showScreen(item.dataset.screen));
    });

    function loadData() {
        // MyPET
        const savedJson = localStorage.getItem(PET_INFO_KEY);
        if (savedJson) {
            try {
                const savedInfo = JSON.parse(savedJson);
                textInputIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && savedInfo[id]) el.value = savedInfo[id];
                });
                radioNames.forEach(name => {
                    if (savedInfo[name]) {
                        const el = document.querySelector(`input[name="${name}"][value="${savedInfo[name]}"]`);
                        if (el) el.checked = true;
                    }
                });
            } catch(e) {}
        }
        
        const savedImage = localStorage.getItem(PET_IMAGE_KEY);
        if (savedImage && profileImagePreview) {
            profileImagePreview.src = savedImage;
        }

        // Plan History
        const historyJson = localStorage.getItem(PLAN_HISTORY_KEY);
        if (historyJson) {
            try { renderPlanHistory(JSON.parse(historyJson)); } catch (e) {}
        }

        // Chat History
        const chatHistoryJson = localStorage.getItem(CHAT_HISTORY_KEY);
        if (chatHistoryJson) {
            try {
                let chatHistory = JSON.parse(chatHistoryJson);
                chatHistory.forEach(msg => {
                    if(!msg.id) msg.id = generateId(); 
                    renderChatMessage(msg.content, msg.sender, msg.timestamp, msg.id);
                });
            } catch (e) {}
        }
        
        // ★追加: Favorites
        loadFavorites();
    }
    loadData();

    // ==========================================
    // 4. UI描画・保存ロジック (Profile/Chat)
    // ==========================================
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', () => {
            const petInfo = {};
            textInputIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) petInfo[id] = el.value;
            });
            radioNames.forEach(name => {
                const checkedEl = document.querySelector(`input[name="${name}"]:checked`);
                if (checkedEl) petInfo[name] = checkedEl.value;
            });
            localStorage.setItem(PET_INFO_KEY, JSON.stringify(petInfo));
            alert('プロフィールを保存しました！');
            showScreen('planConditionScreen');
        });
    }

    if (profileImageInput) {
        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                compressImage(file, function(base64Image) {
                    profileImagePreview.src = base64Image;
                    localStorage.setItem(PET_IMAGE_KEY, base64Image);
                });
            }
        });
    }

    function renderChatMessage(content, sender, timestamp, id) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('chat-message-wrapper', sender);
        wrapper.dataset.id = id;

        const icon = document.createElement('img');
        icon.classList.add('chat-message-icon');
        if (sender === 'user') {
            const savedImage = localStorage.getItem(PET_IMAGE_KEY);
            icon.src = savedImage || '/static/nikukyu.png';
        } else {
            icon.src = '/static/ai-icon.png';
        }
        icon.onerror = function() { this.src = '/static/nikukyu.png'; };
        wrapper.appendChild(icon);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('chat-bubble-container');
        contentDiv.style.alignItems = sender === 'user' ? 'flex-end' : 'flex-start';

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('msg-delete-btn');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = function() { deleteMessage(id, wrapper); };
        contentDiv.appendChild(deleteBtn);

        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender);
        msgDiv.innerHTML = String(content).replace(/\n/g, '<br>');

        const timeDiv = document.createElement('span');
        timeDiv.classList.add('chat-timestamp');
        timeDiv.textContent = timestamp;

        contentDiv.appendChild(msgDiv);
        contentDiv.appendChild(timeDiv);
        wrapper.appendChild(contentDiv);

        chatMessages.appendChild(wrapper);

        requestAnimationFrame(() => {
            if (sender === 'ai') {
                 // AIの回答が始まった位置（アイコンやバブルのトップ）までスクロール
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // ユーザーのメッセージの時は、一番下までスクロール
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    function deleteMessage(id, element) {
        if (!confirm("このメッセージを削除しますか？")) return;
        element.remove();
        let history = [];
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
            try { 
                history = JSON.parse(saved);
                history = history.filter(msg => msg.id !== id);
                localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
            } catch(e) {}
        }
    }

    function addAndSaveChatMessage(content, sender) {
        const timestamp = getCurrentTime();
        const id = generateId();
        renderChatMessage(content, sender, timestamp, id);
        let history = [];
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) { try { history = JSON.parse(saved); } catch(e) {} }
        history.push({ id: id, content: content, sender: sender, timestamp: timestamp });
        if (history.length > 50) history = history.slice(history.length - 50);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
    }

    // ==========================================
    // 5. お気に入り機能 (New!)
    // ==========================================
    
    // お気に入り一覧の読み込みと表示
    function loadFavorites() {
        const saved = localStorage.getItem(PET_FAV_KEY);
        let favorites = [];
        if (saved) { try { favorites = JSON.parse(saved); } catch(e) {} }

        if (favorites.length === 0) {
            favList.innerHTML = `<div class="empty-state"><i class="fas fa-heart"></i><p>お気に入りはまだありません。<br>GUIDEの「♡」を押して登録しよう！</p></div>`;
            return;
        }

        let html = '';
        // 新しい順に表示
        favorites.slice().reverse().forEach(spot => {
            const query = encodeURIComponent(`${spot.name} ${spot.address}`);
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
            const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
            const imageSearchUrl = `https://www.google.com/search?q=${query}&tbm=isch`;
            
            // メモがある場合のみ表示
            const memoHtml = spot.user_memo ? `<div class="fav-user-memo">${spot.user_memo}</div>` : '';

            html += `
            <div class="fav-card">
                <span class="fav-date">📅 登録日: ${spot.saved_at}</span>
                <button class="fav-delete-btn" onclick="removeFavorite('${spot.name}')" title="削除">
                    <i class="fas fa-trash-alt"></i>
                </button>
                
                <h4 style="font-size: 1.1rem; margin: 0 0 5px 0; color: #333;">${spot.name}</h4>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">
                    <i class="fas fa-map-marker-alt" style="color: #FFC107;"></i> ${spot.address}
                </div>
                
                ${memoHtml}

                <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <a href="${routeUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #333; text-decoration: none; padding: 10px; border-radius: 8px; font-size: 0.8rem;">
                        <i class="fas fa-route"></i> ルート
                    </a>
                    <a href="${mapUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #fff; color: #FFC107; text-decoration: none; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #FFC107;">
                        <i class="fas fa-map-marked-alt"></i> 地図
                    </a>
                </div>
                    <a href="${imageSearchUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #FF9800; color: white; text-decoration: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 0.9rem; margin-top: 10px; box-shadow: 0 4px 6px rgba(255, 152, 0, 0.2);">
                         <i class="fas fa-camera" style="margin-right: 8px;"></i> 写真を見る
                     </a>
            </div>`
            ;
        });
        favList.innerHTML = html;
    }
    // グローバル関数として登録 (HTMLのonclickから呼ぶため)
    window.removeFavorite = function(spotName) {
        if(!confirm("このお気に入りを削除しますか？")) return;
        
        let favorites = [];
        const saved = localStorage.getItem(PET_FAV_KEY);
        if (saved) { try { favorites = JSON.parse(saved); } catch(e) {} }
        
        // 名前で一致するものを削除
        favorites = favorites.filter(f => f.name !== spotName);
        localStorage.setItem(PET_FAV_KEY, JSON.stringify(favorites));
        
        loadFavorites(); // 再描画
        // GUIDE画面のハートの色も戻すためにリロードしてもいいが、今回は簡易的に
        renderPlanHistory(JSON.parse(localStorage.getItem(PLAN_HISTORY_KEY) || '[]')); 
    };

    // お気に入り登録/解除の切り替え (GUIDE画面から呼ばれる)
    window.toggleFavorite = function(btn, name, address, description) {
        let favorites = [];
        const saved = localStorage.getItem(PET_FAV_KEY);
        if (saved) { try { favorites = JSON.parse(saved); } catch(e) {} }

        const existingIndex = favorites.findIndex(f => f.name === name);

        if (existingIndex >= 0) {
            // 既に登録済み -> 解除
            if(!confirm("お気に入りから削除しますか？")) return;
            favorites.splice(existingIndex, 1);
            btn.classList.remove('active');
        } else {
            // 新規登録 -> メモ入力
            const memo = prompt("お気に入りに追加します！\n一言メモがあれば入力してください（任意）:", "");
            if (memo === null) return; // キャンセル

            const newFav = {
                name: name,
                address: address,
                description: description,
                user_memo: memo || "",
                saved_at: getCurrentTime()
            };
            favorites.push(newFav);
            btn.classList.add('active');
            alert("お気に入りに登録しました！\n「FAV」画面で確認できます。");
        }
        localStorage.setItem(PET_FAV_KEY, JSON.stringify(favorites));
    };

    // ==========================================
    // 6. プラン履歴描画 (ハートボタン追加)
    // ==========================================
    function renderPlanHistory(historyArray) {
        if (!historyArray || historyArray.length === 0) {
            guideResults.innerHTML = `<div class="empty-state"><i class="fas fa-map-marked-alt"></i><p>まだプランがありません。<br>「PLAN」画面で作ってみよう！</p></div>`;
            return;
        }

        // 現在のお気に入りリストを取得（ハートの色判定用）
        let favorites = [];
        try { favorites = JSON.parse(localStorage.getItem(PET_FAV_KEY) || '[]'); } catch(e){}
        const favNames = favorites.map(f => f.name);

        let fullHtml = "";
        historyArray.forEach((data, hIndex) => {
            const timestamp = data.timestamp || '日付不明';
            if (hIndex > 0) fullHtml += `<div class="plan-history-separator">▼ 過去のプラン</div>`;

            let html = `
            <div class="plan-container">
                <div style="background: linear-gradient(135deg, #fff, #f9f9f9); padding: 20px; border-radius: 15px; border: 2px solid #FF9800; margin-bottom: 20px; text-align: center;">
                    <div style="font-size: 0.8rem; color: #888; margin-bottom: 5px;">📅 ${timestamp} 作成</div>
                    <h3 style="color: #F57C00; margin-top: 0;">🐶 ${data.plan_title || 'おすすめプラン'}</h3>
                    <p style="color: #555; font-size: 0.95rem;">${data.greeting_message || ''}</p>
                </div>`;

            if (data.spots && Array.isArray(data.spots)) {
                data.spots.forEach((spot, index) => {
                    const query = encodeURIComponent(`${spot.name} ${spot.address}`);
                    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
                    const imageSearchUrl = `https://www.google.com/search?q=${query}&tbm=isch`;
                    const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
                    
                    // お気に入り済みかチェック
                    const isFav = favNames.includes(spot.name);
                    const heartClass = isFav ? 'active' : '';

                    // データ渡し用のエスケープ処理
                    const safeName = spot.name.replace(/'/g, "\\'");
                    const safeAddress = spot.address.replace(/'/g, "\\'");
                    const safeDesc = (spot.description || "").replace(/'/g, "\\'");

                    html += `
                    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); position: relative; overflow: hidden;">
                        
                        <!-- ★追加: ハートボタン -->
                        <button class="fav-btn ${heartClass}" onclick="toggleFavorite(this, '${safeName}', '${safeAddress}', '${safeDesc}')">
                            <i class="fas fa-heart"></i>
                        </button>

                        <div style="position: absolute; top: 0; left: 0; background: #FF9800; color: white; padding: 5px 15px; border-bottom-right-radius: 12px; font-weight: bold; font-size: 1rem; z-index: 5;">
                            ${index + 1}
                        </div>
                        <div style="margin-top: 30px;">
                            <h4 style="font-size: 1.2rem; color: #333; margin: 0 0 10px 0; border-bottom: 2px solid #eee; padding-bottom: 10px; padding-right: 40px;">
                                ${spot.name}
                            </h4>
                            <div style="font-size: 0.95rem; color: #444; margin-bottom: 8px;">
                                <i class="fas fa-map-marker-alt" style="color: #FF9800; margin-right: 5px;"></i> 
                                ${spot.address}
                            </div>
                            <div style="font-size: 0.9rem; color: #333; margin-bottom: 15px; background: #FFF3E0; padding: 10px; border-radius: 8px; border-left: 4px solid #FF9800;">
                                <i class="fas fa-paw" style="color: #FF9800; margin-right: 5px;"></i>
                                <strong>条件:</strong> ${spot.pet_condition}
                            </div>
                            <p style="font-size: 0.95rem; color: #555; line-height: 1.6; margin-bottom: 15px;">${spot.description}</p>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <a href="${routeUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #333; text-decoration: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 0.85rem; border: 1px solid #ddd;">
                                <i class="fas fa-route" style="margin-right: 5px;"></i> ルート検索
                            </a>
                            <a href="${mapUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #fff; color: #FF9800; text-decoration: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 0.85rem; border: 1px solid #FF9800;">
                                <i class="fas fa-map-marked-alt" style="margin-right: 5px;"></i> 地図
                            </a>
                        </div>
                        <a href="${imageSearchUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; background: #FF9800; color: white; text-decoration: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 0.9rem; margin-top: 10px; box-shadow: 0 4px 6px rgba(255, 152, 0, 0.2);">
                            <i class="fas fa-camera" style="margin-right: 8px;"></i> 写真を見る
                        </a>
                    </div>`;
                });
            }
            html += `</div>`;
            fullHtml += html;
        });
        guideResults.innerHTML = fullHtml;
    }

    // ==========================================
    // 7. API通信
    // ==========================================
    async function callAI(messageStr, isPlanMode) {
        if (createPlanButton) createPlanButton.disabled = true;
        if (sendMessageButton) sendMessageButton.disabled = true;
        if (chatInput) chatInput.disabled = true;

        if (isPlanMode) planLoading.style.display = 'flex';
        else chatLoading.style.display = 'flex';

        const savedJson = localStorage.getItem(PET_INFO_KEY);
        const petInfo = savedJson ? JSON.parse(savedJson) : {};

        const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
        let history = [];
        if (historyJson) {
            try { history = JSON.parse(historyJson); } catch(e) {}
        }

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    petInfo: petInfo,
                    message: messageStr,
                    history: history
                })
            });

            if (!response.ok) {
                if (response.status === 503) throw new Error("アクセスが集中しています。20秒ほど待ってから再試行してください。");
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.error) {
                alert(`エラー: ${data.error}`);
                return;
            }

            if (isPlanMode) {
                if (data.plan_title) {
                    data.timestamp = getCurrentTime();
                    let history = [];
                    const historyJson = localStorage.getItem(PLAN_HISTORY_KEY);
                    if (historyJson) history = JSON.parse(historyJson);
                    history.unshift(data);
                    if (history.length > 10) history.pop();
                    localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(history));
                    renderPlanHistory(history);
                    showScreen('guideScreen'); 
                } else {
                    alert("プラン作成に失敗しました。条件を変えて試してください。");
                }
            } else {
                if (data.response) {
                    addAndSaveChatMessage(data.response, 'ai');
                } else if (data.plan_title) {
                    addAndSaveChatMessage(data.greeting_message + "\n(プランが作成されました。GUIDE画面を確認してください)", 'ai');
                    data.timestamp = getCurrentTime();
                    let history = [];
                    const historyJson = localStorage.getItem(PLAN_HISTORY_KEY);
                    if (historyJson) history = JSON.parse(historyJson);
                    history.unshift(data);
                    localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(history));
                    renderPlanHistory(history);
                }
            }

        } catch (e) {
            console.error(e);
            alert(e.message);
        } finally {
            planLoading.style.display = 'none';
            chatLoading.style.display = 'none';
            if (createPlanButton) createPlanButton.disabled = false;
            if (sendMessageButton) sendMessageButton.disabled = false;
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.focus();
            }
        }
    }

    if (createPlanButton) {
        createPlanButton.addEventListener('click', () => {
            const area = document.getElementById('target_area').value.trim();
            const residence = document.getElementById('owner_residence').value.trim();
            if (!area && !residence) {
                alert('「行きたいエリア」またはプロフィール画面で「居住地」を入力してください！');
                return;
            }
            const tr = document.getElementById('transportation').value;
            const du = document.getElementById('duration').value;
            const mo = document.getElementById('user_mood').value;
            const requestMessage = `【プラン作成依頼】エリア：${area || residence + "周辺"}, 移動：${tr}, 時間：${du}, 要望：${mo}。プランを作って。`;
            callAI(requestMessage, true);
        });
    }

    if (sendMessageButton) {
        sendMessageButton.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if(!text) return;
            addAndSaveChatMessage(text, 'user');
            chatInput.value = '';
            callAI(text, false);
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessageButton.click();
        });
    }

    if(resetButton) {
        resetButton.addEventListener('click', () => {
            if(confirm("全てのデータ（履歴・プロフィール・お気に入り）を削除してリセットしますか？")) {
                localStorage.clear();
                location.reload();
            }
        });
    }

    if(chatDeleteModeBtn) {
        chatDeleteModeBtn.addEventListener('click', () => {
            const container = document.getElementById('chatMessages');
            container.classList.toggle('delete-mode-active');
            chatDeleteModeBtn.classList.toggle('active');
        });
    }

});
