import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBdVZRNj5-ni4rqhlYoN7jJKd4lwMWZG-Q",
    authDomain: "dziennik-snow.firebaseapp.com",
    databaseURL: "https://dziennik-snow-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dziennik-snow",
    storageBucket: "dziennik-snow.appspot.com",
    messagingSenderId: "1041128277683",
    appId: "1:1041128277683:web:8bdfa137c75e0c3bced7dd"
};

try {
    const app = initializeApp(firebaseConfig);
    console.log('Firebase zainicjalizowany.');
    const db = getDatabase(app);
    const auth = getAuth(app);

    // Elementy DOM
    const adminModal = document.getElementById('adminModal');
    const postModal = document.getElementById('postModal');
    const adminLink = document.getElementById('adminLink');
    const logoutLink = document.getElementById('logoutLink');
    const googleLogin = document.getElementById('googleLogin');
    const closes = document.querySelectorAll('.modal-close');
    const networkStatus = document.getElementById('networkStatus');
    const postsList = document.getElementById('postsList');
    const archiveList = document.getElementById('archiveList');
    const dreamForm = document.getElementById('dreamForm');
    const postsLoading = document.getElementById('postsLoading');
    const archiveLoading = document.getElementById('archiveLoading');
    const closeForm = document.getElementById('closeForm');
    const postModalTitle = document.getElementById('postModalTitle');
    const postIdInput = document.getElementById('postId');

    // Sprawdzenie elementów
    if (!adminModal || !postModal || !adminLink || !logoutLink || !googleLogin || !closes.length || !networkStatus || !postsList || !archiveList || !dreamForm || !postsLoading || !archiveLoading || !closeForm || !postModalTitle || !postIdInput) {
        console.error('Brak elementów DOM:', {
            adminModal, postModal, adminLink, logoutLink, googleLogin, closes, networkStatus,
            postsList, archiveList, dreamForm, postsLoading, archiveLoading, closeForm, postModalTitle, postIdInput
        });
        networkStatus.textContent = 'Błąd: Brak elementów strony.';
        networkStatus.style.display = 'block';
        throw new Error('Brak elementów DOM');
    }

    // Inicjalny stan modalów i linków
    adminModal.style.display = 'none';
    postModal.style.display = 'none';
    logoutLink.style.display = 'none';
    adminLink.textContent = 'Panel Administratora';

    // Status sieci
    const updateNetworkStatus = () => {
        if (navigator.onLine) {
            networkStatus.classList.remove('offline');
            networkStatus.style.display = 'none';
        } else {
            networkStatus.classList.add('offline');
            networkStatus.textContent = 'Brak połączenia z internetem.';
            networkStatus.style.display = 'block';
        }
    };
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    // Zarządzanie cache
    const CACHE_TIMEOUT = 48 * 60 * 60 * 1000; // 48 godzin
    const CLEANUP_INTERVAL = 3600000; // 1 godzina

    function getCachedData(key) {
        const cachedData = localStorage.getItem(key);
        const cachedTime = localStorage.getItem(`${key}_time`);
        if (cachedData && cachedTime) {
            const now = Date.now();
            if (now - parseInt(cachedTime) < CACHE_TIMEOUT) {
                console.log(`Pobrano z cache: ${key}`);
                return JSON.parse(cachedData);
            } else {
                console.log(`Cache dla ${key} przeterminowany`);
                localStorage.removeItem(key);
                localStorage.removeItem(`${key}_time`);
            }
        }
        return null;
    }

    function setCachedData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(`${key}_time`, Date.now().toString());
            console.log(`Zapisano do cache: ${key}`);
        } catch (error) {
            console.error(`Błąd zapisu do cache dla ${key}:`, error);
        }
    }

    function cleanOldCache() {
        const now = Date.now();
        const lastCleanupTime = localStorage.getItem('lastCleanupTime');
        const isCleanupTriggered = localStorage.getItem('isCleanupTriggered');

        if (isCleanupTriggered === 'true' || (lastCleanupTime && (now - parseInt(lastCleanupTime) < CLEANUP_INTERVAL))) {
            console.debug('Czyszczenie cache pominięte');
            return;
        }

        console.log('Rozpoczynam czyszczenie localStorage...');
        localStorage.setItem('isCleanupTriggered', 'true');

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.endsWith('_time') && key !== 'lastCleanupTime') {
                const cachedTime = parseInt(localStorage.getItem(key));
                if (now - cachedTime > CACHE_TIMEOUT) {
                    const dataKey = key.replace('_time', '');
                    keysToRemove.push(key, dataKey);
                }
            }
        }

        keysToRemove.forEach(key => {
            console.log(`Usuwam klucz: ${key}`);
            localStorage.removeItem(key);
        });

        localStorage.setItem('lastCleanupTime', now.toString());
        localStorage.removeItem('isCleanupTriggered');
        console.log('Czyszczenie localStorage zakończone');
    }

    // Funkcja formatowania treści z zachowaniem pustych linii
    const formatContent = (content) => {
        if (!content) return 'Brak treści';
        return content
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>').replace(/^$/, '')}</p>`)
            .join('');
    };

    // Funkcja obcinania treści w przedziale 700–900 znaków
    const truncateContent = (content) => {
        if (!content) return { short: 'Brak treści', needsToggle: false };
        if (content.length <= 700) {
            return { short: content, needsToggle: false };
        }

        const searchText = content.slice(0, 900);
        const lastEmptyLineIndex = searchText.lastIndexOf('\n\n');
        if (lastEmptyLineIndex >= 700) {
            const cutIndex = lastEmptyLineIndex;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        const substring = content.slice(700, 900);
        const lastPeriodIndex = substring.lastIndexOf('.');
        if (lastPeriodIndex !== -1) {
            const cutIndex = 700 + lastPeriodIndex + 1;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        const lastCommaIndex = substring.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
            const cutIndex = 700 + lastCommaIndex + 1;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        let endIndex = 900;
        if (content.length < 900) {
            endIndex = content.length;
        }
        while (endIndex > 700 && content[endIndex] !== ' ' && content[endIndex] !== '\n') {
            endIndex--;
        }
        if (endIndex > 700) {
            return { short: content.slice(0, endIndex).trim(), needsToggle: true };
        }

        return { short: content.slice(0, 700), needsToggle: true };
    };

    // Funkcja otwierania formularza posta
    const openPostModal = (postId = null, postData = null) => {
        postModalTitle.textContent = postId ? 'Edytuj sen' : 'Dodaj nowy sen';
        postIdInput.value = postId || '';
        document.getElementById('postTitle').value = postData?.title || '';
        document.getElementById('dreamDate').value = postData?.dreamDate || '';
        document.getElementById('postNotes').value = postData?.notes || '';
        document.getElementById('postContent').value = postData?.content || '';
        postModal.style.display = 'block';
        adminModal.style.display = 'none';
        console.log(postId ? `Otwarto formularz edycji dla posta: ${postId}` : 'Otwarto formularz dodawania.', postData);
    };

    // Otwieranie modala logowania lub formularza
    let isAuthenticated = false;
    adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (isAuthenticated) {
            openPostModal();
        } else {
            adminModal.style.display = 'block';
            postModal.style.display = 'none';
            console.log('Otwarto modal logowania.');
        }
    });

    // Wylogowanie
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            console.log('Wylogowano pomyślnie.');
            isAuthenticated = false;
            adminLink.textContent = 'Panel Administratora';
            logoutLink.style.display = 'none';
            adminModal.style.display = 'none';
            postModal.style.display = 'none';
            alert('Wylogowano pomyślnie.');
        } catch (error) {
            console.error('Błąd wylogowania:', error);
            alert(`Błąd wylogowania: ${error.message}`);
            networkStatus.textContent = 'Błąd wylogowania. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
        }
    });

    // Zamykanie modalów
    closes.forEach(close => {
        close.addEventListener('click', () => {
            adminModal.style.display = 'none';
            postModal.style.display = 'none';
            dreamForm.reset();
            postIdInput.value = '';
            postModalTitle.textContent = 'Dodaj nowy sen';
            console.log('Zamknięto modal.');
        });
    });

    closeForm.addEventListener('click', () => {
        adminModal.style.display = 'none';
        postModal.style.display = 'none';
        dreamForm.reset();
        postIdInput.value = '';
        postModalTitle.textContent = 'Dodaj nowy sen';
        console.log('Zamknięto formularz.');
    });

    // Logowanie Google
    googleLogin.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        try {
            console.log('Próba logowania Google...');
            const result = await signInWithPopup(auth, provider);
            console.log('Logowanie udane:', result.user.email);
            if (result.user.email === 'lukasz13d@gmail.com') {
                isAuthenticated = true;
                adminModal.style.display = 'none';
                openPostModal();
            } else {
                alert('Tylko autor ma dostęp do edycji.');
                await signOut(auth);
                console.log('Wylogowano nieautoryzowanego użytkownika.');
            }
        } catch (error) {
            console.error('Błąd logowania:', error);
            alert(`Błąd logowania: ${error.message} (Kod: ${error.code})`);
            if (error.code === 'auth/popup-blocked') {
                alert('Popup zablokowany. Włącz wyskakujące okna dla tej strony.');
            }
            networkStatus.textContent = 'Błąd logowania. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
        }
    });

    // Obsługa stanu autoryzacji
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === 'lukasz13d@gmail.com') {
            console.log('Zalogowano:', user.email);
            isAuthenticated = true;
            adminLink.textContent = 'Dodaj nowy post';
            logoutLink.style.display = 'inline';
        } else {
            console.log('Brak zalogowanego użytkownika lub nieprawidłowy email.');
            isAuthenticated = false;
            adminLink.textContent = 'Panel Administratora';
            logoutLink.style.display = 'none';
            adminModal.style.display = 'none';
            postModal.style.display = 'none';
        }
    });

    // Mechanizm pobierania danych
    const fetchPost = (postId) => {
        return new Promise((resolve, reject) => {
            onValue(ref(db, `posts/${postId}`), (snapshot) => {
                const postData = snapshot.val();
                if (postData) {
                    resolve({ id: postId, ...postData });
                } else {
                    reject(new Error(`Brak danych dla posta ${postId}`));
                }
            }, { onlyOnce: true });
        });
    };

    // Funkcja kolejkowania z priorytetem dla najnowszych
    const fetchPostsInOrder = async (posts) => {
        const parsePostDate = (postDate) => {
            if (!postDate || typeof postDate !== 'string') return 0;
            const match = postDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (!match) {
                console.warn(`Nieprawidłowy format postDate: ${postDate}`);
                return 0;
            }
            const [_, day, month, year] = match;
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (isNaN(date.getTime())) {
                console.warn(`Nieprawidłowa data postDate: ${postDate}`);
                return 0;
            }
            return date.getTime();
        };

        const sortedPosts = posts
            .map(post => ({
                ...post,
                sortTime: parsePostDate(post.postDate) || post.createdAt || 0
            }))
            .filter(post => post.sortTime > 0)
            .sort((a, b) => b.sortTime - a.sortTime); // Od najnowszego

        console.log('Posortowane posty:', sortedPosts.map(p => ({ title: p.title, postDate: p.postDate, createdAt: p.sortTime })));

        const fetchedPosts = [];
        for (const post of sortedPosts) {
            try {
                const fullPost = await fetchPost(post.id);
                fetchedPosts.push(fullPost);
                console.log(`Pobrano post: ${fullPost.title}`);
            } catch (error) {
                console.error(`Błąd pobierania posta ${post.id}:`, error);
            }
        }
        return fetchedPosts;
    };

    // Funkcja konfiguracji przycisków edycji
    const setupEditButton = async () => {
        const editButtons = document.querySelectorAll('.btn-edit');
        if (editButtons.length === 0) {
            console.warn('Brak przycisków edycji do skonfigurowania.');
        }
        editButtons.forEach(button => {
            const postId = button.dataset.id;
            button.replaceWith(button.cloneNode(true));
            const newButton = document.querySelector(`.btn-edit[data-id="${postId}"]`);
            newButton.addEventListener('click', async () => {
                try {
                    const postData = await fetchPost(postId);
                    console.log('Kliknięto Edytuj dla posta:', postId, postData.title);
                    openPostModal(postId, postData);
                } catch (error) {
                    console.error('Błąd ładowania danych do edycji:', error);
                    networkStatus.textContent = 'Błąd ładowania danych do edycji.';
                    networkStatus.style.display = 'block';
                }
            });
        });
    };

    // Funkcja ładowania domyślnego widoku archiwum
    const loadArchiveDefault = (allPosts) => {
        archiveList.innerHTML = '';
        archiveLoading.classList.add('show');

        const parsePostDate = (postDate) => {
            if (!postDate || typeof postDate !== 'string') return 0;
            const match = postDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (!match) {
                console.warn(`Nieprawidłowy format postDate: ${postDate}`);
                return 0;
            }
            const [_, day, month, year] = match;
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (isNaN(date.getTime())) {
                console.warn(`Nieprawidłowa data postDate: ${postDate}`);
                return 0;
            }
            return date.getTime();
        };

        const olderPosts = allPosts
            .filter(post => post.postDate || post.createdAt)
            .sort((a, b) => {
                const timeA = parsePostDate(a.postDate) || a.createdAt || 0;
                const timeB = parsePostDate(b.postDate) || b.createdAt || 0;
                return timeB - timeA; // Od najnowszego
            })
            .slice(3); // Od 4. posta wzwyż

        console.log('Posty w archiwum:', olderPosts.length, olderPosts.map(p => ({ title: p.title, postDate: p.postDate, createdAt: p.createdAt })));

        if (olderPosts.length === 0) {
            archiveList.innerHTML = '<p class="no-posts">Brak postów w archiwum.</p>';
        } else {
            olderPosts.forEach((post) => {
                const archiveItem = document.createElement('div');
                archiveItem.className = 'archive-item';
                archiveItem.innerHTML = `
                    <span>
                        <span class="archive-title">${post.title || 'Bez tytułu'}</span>
                        <span class="archive-date"> - Opublikowano ${post.postDate || 'Brak daty'}</span>
                    </span>
                    <span class="expand-arrow">▼</span>
                `;
                archiveItem.addEventListener('click', async () => {
                    try {
                        const fullPost = await fetchPost(post.id);
                        console.log('Ładowanie posta z archiwum:', fullPost.title, fullPost.id);
                        archiveList.innerHTML = `
                            <div class="post">
                                <div class="post-meta">Opublikowano: ${fullPost.postDate || 'Brak daty'} o ${fullPost.postTime || 'Brak godziny'}</div>
                                <h3 class="post-title">${fullPost.title || 'Bez tytułu'}</h3>
                                <div class="post-data"><strong>Data snu:</strong> ${fullPost.dreamDate || 'Brak daty'}</div>
                                ${fullPost.notes ? `<div class="post-notes"><strong>Uwagi:</strong> <span>${fullPost.notes}</span></div>` : ''}
                                <div class="post-content">${formatContent(fullPost.content)}</div>
                                ${isAuthenticated ? `<button class="btn btn-edit" data-id="${fullPost.id}">Edytuj</button>` : ''}
                                <p><span class="return-link">Powrót do archiwum</span></p>
                            </div>
                        `;
                        const returnLink = document.querySelector('.return-link');
                        if (returnLink) {
                            returnLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                console.log('Powrót do archiwum.');
                                loadArchiveDefault(allPosts);
                            });
                        }
                        if (isAuthenticated) {
                            await setupEditButton();
                        }
                    } catch (error) {
                        console.error('Błąd ładowania posta z archiwum:', error);
                        networkStatus.textContent = 'Błąd ładowania posta z archiwum.';
                        networkStatus.style.display = 'block';
                    }
                });
                archiveList.appendChild(archiveItem);
            });
        }

        archiveLoading.classList.remove('show');
        if (isAuthenticated) {
            setupEditButton();
        }
    };

    // Funkcja wyświetlania postów (używana dla cache i danych z Firebase)
    const displayPosts = (posts, isFromCache = false) => {
        postsList.innerHTML = '';
        postsLoading.classList.add('show');

        const latestPosts = posts.slice(0, 3);

        if (latestPosts.length === 0) {
            postsList.innerHTML = '<p class="no-posts">Brak postów do wyświetlenia.</p>';
            postsLoading.classList.remove('show');
            return;
        }

        latestPosts.forEach((post) => {
            const postDiv = document.createElement('div');
            postDiv.className = 'post';
            const { short, needsToggle } = truncateContent(post.content);
            let shortContent = formatContent(short);
            const fullContent = formatContent(post.content);

            if (needsToggle && short.endsWith('\n\n')) {
                shortContent = shortContent.slice(0, -7) + '<p><span class="content-toggle" data-toggle="expand">Rozwiń treść</span></p>';
            }

            postDiv.innerHTML = `
                <div class="post-meta">Opublikowano: ${post.postDate || 'Brak daty'} o ${post.postTime || 'Brak godziny'}</div>
                <h3 class="post-title">${post.title || 'Bez tytułu'}</h3>
                <div class="post-data"><strong>Data snu:</strong> ${post.dreamDate || 'Brak daty'}</div>
                ${post.notes ? `<div class="post-notes"><strong>Uwagi:</strong> <span>${post.notes}</span></div>` : ''}
                <div class="post-content">${shortContent}</div>
                ${needsToggle ? `<div class="post-content-full">${fullContent}</div>` : ''}
                ${needsToggle && !short.endsWith('\n\n') ? `<p><span class="content-toggle" data-toggle="expand">Rozwiń treść</span></p>` : ''}
                ${needsToggle ? `<p class="content-collapse" style="display: none;"><span class="content-toggle" data-toggle="collapse">Zwiń treść</span></p>` : ''}
                ${isAuthenticated ? `<button class="btn btn-edit" data-id="${post.id}">Edytuj</button>` : ''}
            `;
            postsList.appendChild(postDiv);

            if (needsToggle) {
                const expandLink = postDiv.querySelector('.content-toggle[data-toggle="expand"]');
                const collapseLink = postDiv.querySelector('.content-toggle[data-toggle="collapse"]');
                const contentShort = postDiv.querySelector('.post-content');
                const contentFull = postDiv.querySelector('.post-content-full');
                const collapseP = postDiv.querySelector('.content-collapse');

                if (expandLink && collapseLink && contentShort && contentFull && collapseP) {
                    expandLink.addEventListener('click', () => {
                        contentShort.style.display = 'none';
                        contentFull.style.display = 'block';
                        expandLink.parentElement.style.display = 'none';
                        collapseP.style.display = 'block';
                        console.log(`Rozwinięto treść posta: ${post.title}`);
                    });
                    collapseLink.addEventListener('click', () => {
                        contentShort.style.display = 'block';
                        contentFull.style.display = 'none';
                        if (!short.endsWith('\n\n')) {
                            expandLink.parentElement.style.display = 'block';
                        }
                        collapseP.style.display = 'none';
                        console.log(`Zwinięto treść posta: ${post.title}`);
                    });
                }
            }
        });

        postsLoading.classList.remove('show');
        if (isAuthenticated) {
            setupEditButton();
        }

        console.log(`${isFromCache ? 'Wyświetlono posty z cache' : 'Wyświetlono posty z Firebase'}: ${latestPosts.length}`);
    };

    // Funkcja ładowania domyślnego widoku strony
    const loadDefaultView = async () => {
        // Wczytaj dane z cache jako fallback
        const cachedPosts = getCachedData('posts');
        if (cachedPosts && navigator.onLine) {
            console.log('Wczytuję dane z cache jako fallback...');
            displayPosts(cachedPosts, true);
            loadArchiveDefault(cachedPosts);
        } else if (cachedPosts) {
            // Jeśli offline, użyj cache i nie próbuj pobierać z Firebase
            console.log('Offline: Wczytuję tylko dane z cache...');
            displayPosts(cachedPosts, true);
            loadArchiveDefault(cachedPosts);
            return;
        } else {
            postsList.innerHTML = '<p class="no-posts">Ładowanie postów...</p>';
            archiveList.innerHTML = '<p class="no-posts">Ładowanie archiwum...</p>';
        }

        postsLoading.classList.add('show');
        archiveLoading.classList.add('show');

        try {
            // Wyczyść stary cache przed pobraniem nowych danych
            cleanOldCache();

            const snapshot = await new Promise((resolve, reject) => {
                onValue(ref(db, 'posts'), (snap) => resolve(snap), { onlyOnce: true }, reject);
            });

            const posts = [];
            snapshot.forEach((child) => {
                posts.push({ id: child.key, ...child.val() });
            });

            console.log('Wszystkie posty z Firebase:', posts.length, posts.map(p => ({ title: p.title, postDate: p.postDate, createdAt: p.createdAt })));

            const fetchedPosts = await fetchPostsInOrder(posts);

            // Zapisz dane do cache
            setCachedData('posts', fetchedPosts);

            // Wyświetl aktualne dane
            displayPosts(fetchedPosts, false);
            loadArchiveDefault(fetchedPosts);
        } catch (error) {
            console.error('Błąd ładowania postów:', error);
            networkStatus.textContent = 'Błąd ładowania postów. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
            postsLoading.classList.remove('show');
            archiveLoading.classList.remove('show');
        }
    };

    // Zarządzanie interwałami aktualizacji
    let updateIntervalId = null;
    let isManagingIntervals = false;
    const MIN_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minuty
    let lastUpdateTime = null;

    function startUpdateInterval() {
        console.log('Uruchamiam interwał aktualizacji postów');
        loadDefaultView();
        updateIntervalId = setInterval(() => {
            console.log('Aktualizuję posty i archiwum...');
            loadDefaultView();
        }, 3600000); // 1 godzina
    }

    function manageUpdateIntervals() {
        if (isManagingIntervals) {
            console.log('manageUpdateIntervals już uruchomione, pomijam');
            return;
        }
        isManagingIntervals = true;

        const now = Date.now();

        if (document.visibilityState === 'visible' && navigator.onLine) {
            console.log('Karta aktywna, włączam aktualizacje');
            if (updateIntervalId) {
                clearInterval(updateIntervalId);
                updateIntervalId = null;
            }

            if (!lastUpdateTime || (now - lastUpdateTime >= MIN_REFRESH_INTERVAL)) {
                console.log('Minął minimalny czas, odświeżam dane');
                startUpdateInterval();
                lastUpdateTime = now;
            } else {
                console.log('Zbyt szybkie przełączenie, ustawiam tylko interwał');
                updateIntervalId = setInterval(() => {
                    console.log('Aktualizuję posty i archiwum...');
                    loadDefaultView();
                }, 3600000);
            }
        } else {
            console.log('Karta nieaktywna lub offline, wstrzymuję aktualizacje');
            if (updateIntervalId) {
                clearInterval(updateIntervalId);
                updateIntervalId = null;
            }
        }

        isManagingIntervals = false;
    }

    // Dodawanie lub edycja posta
    dreamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = postIdInput.value;
        const title = document.getElementById('postTitle').value.trim();
        const dreamDate = document.getElementById('dreamDate').value.trim();
        const notes = document.getElementById('postNotes').value.trim();
        const content = document.getElementById('postContent').value.trim();
        if (!title || !dreamDate || !content) {
            alert('Wypełnij wszystkie wymagane pola!');
            return;
        }
        const now = new Date();
        const postDate = now.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const postTime = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

        let postData;
        if (postId) {
            try {
                const existingPost = await fetchPost(postId);
                postData = {
                    title,
                    dreamDate,
                    notes: notes || null,
                    content,
                    postDate: existingPost.postDate,
                    postTime,
                    createdAt: existingPost.createdAt || serverTimestamp()
                };
                console.log('Edycja posta:', { title, postDate: postData.postDate, createdAt: postData.createdAt });
            } catch (error) {
                console.error('Błąd pobierania istniejącego posta:', error);
                alert('Błąd pobierania danych posta do edycji.');
                return;
            }
        } else {
            postData = {
                title,
                dreamDate,
                notes: notes || null,
                content,
                postDate,
                postTime,
                createdAt: serverTimestamp()
            };
            console.log('Nowy post:', { title, postDate, createdAt: 'serverTimestamp' });
        }

        try {
            if (postId) {
                await set(ref(db, `posts/${postId}`), postData);
                alert('Sen zaktualizowany pomyślnie!');
            } else {
                await push(ref(db, 'posts'), postData);
                alert('Sen zapisany pomyślnie!');
            }
            dreamForm.reset();
            postIdInput.value = '';
            postModalTitle.textContent = 'Dodaj nowy sen';
            postModal.style.display = 'none';
            console.log(postId ? `Post zaktualizowany: ${title}, postDate: ${postData.postDate}` : 'Post zapisany.');
            await loadDefaultView();
        } catch (error) {
            console.error('Błąd zapisu posta:', error);
            alert(`Błąd zapisu posta: ${error.message}`);
            networkStatus.textContent = 'Błąd zapisu posta. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
        }
    });

    // Inicjalizacja
    window.onload = function() {
        console.log('Inicjalizacja Dreamscape...');
        if (navigator.onLine) {
            loadDefaultView();
            manageUpdateIntervals();
        } else {
            // Wczytaj tylko cache, jeśli offline
            const cachedPosts = getCachedData('posts');
            if (cachedPosts) {
                console.log('Offline: Inicjalizacja z cache...');
                displayPosts(cachedPosts, true);
                loadArchiveDefault(cachedPosts);
            } else {
                console.warn('Offline: Brak danych w cache');
                postsList.innerHTML = '<p class="no-posts">Brak połączenia i danych w pamięci podręcznej.</p>';
                archiveList.innerHTML = '<p class="no-posts">Brak połączenia i danych w pamięci podręcznej.</p>';
            }
        }

        document.addEventListener('visibilitychange', () => {
            console.log(`Zmiana widoczności: ${document.visibilityState}`);
            manageUpdateIntervals();
        });

        window.addEventListener('online', () => {
            console.log('Połączenie przywrócone, ładuję dane');
            loadDefaultView();
            manageUpdateIntervals();
        });

        window.addEventListener('offline', () => {
            console.log('Utracono połączenie, przełączam na cache');
            const cachedPosts = getCachedData('posts');
            if (cachedPosts) {
                displayPosts(cachedPosts, true);
                loadArchiveDefault(cachedPosts);
            }
        });

        window.addEventListener('beforeunload', () => {
            if (updateIntervalId) clearInterval(updateIntervalId);
            console.log('Wstrzymano interwały przed opuszczeniem strony');
        });
    };
} catch (error) {
    console.error('Błąd inicjalizacji Firebase:', error);
    const networkStatus = document.getElementById('networkStatus');
    if (networkStatus) {
        networkStatus.textContent = 'Krytyczny błąd Firebase. Sprawdź konsolę.';
        networkStatus.style.display = 'block';
    }
}
