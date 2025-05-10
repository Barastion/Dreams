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

    // Inicjalny stan modalów
    adminModal.style.display = 'none';
    postModal.style.display = 'none';
    logoutLink.style.display = 'none';

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

    // Funkcja formatowania treści z zachowaniem pustych linii
    const formatContent = (content) => {
        if (!content) return 'Brak treści';
        // Zachowaj puste linie jako puste akapity
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

        // Wyszukaj ostatnią pustą linię do 900 znaków
        const searchText = content.slice(0, 900);
        const lastEmptyLineIndex = searchText.lastIndexOf('\n\n');
        if (lastEmptyLineIndex >= 700) {
            const cutIndex = lastEmptyLineIndex + 2;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        // Wyszukaj w przedziale 700–900 znaków
        const substring = content.slice(700, 900);
        
        // Priorytet 2: Ostatnia kropka (koniec zdania)
        const lastPeriodIndex = substring.lastIndexOf('.');
        if (lastPeriodIndex !== -1) {
            const cutIndex = 700 + lastPeriodIndex + 1;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        // Priorytet 3: Ostatni przecinek
        const lastCommaIndex = substring.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
            const cutIndex = 700 + lastCommaIndex + 1;
            return { short: content.slice(0, cutIndex), needsToggle: true };
        }

        // Priorytet 4: Ostatnie pełne słowo
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

        // Ostatnia opcja: Obcięcie po 700 znakach
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
            adminLink.textContent = 'Napisz nowy post';
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
            adminLink.textContent = 'Napisz nowy post';
            logoutLink.style.display = 'none';
            admin坑Modal.style.display = 'none';
            postModal.style.display = 'none';
        }
    });

    // Mechanizm kolejkowania pobierania danych
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
        const sortedPosts = posts
            .filter(post => post.createdAt)
            .sort((a, b) => b.createdAt - a.createdAt); // Od najnowszego

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
        editButtons.forEach(button => {
            const postId = button.dataset.id;
            button.addEventListener('click', async () => {
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

        const olderPosts = allPosts
            .filter(post => post.createdAt)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(3); // Od 4. posta wzwyż

        console.log('Posty w archiwum:', olderPosts.length, olderPosts.map(p => ({ title: p.title, createdAt: p.createdAt })));

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
                        // Obsługa powrotu do archiwum
                        const returnLink = document.querySelector('.return-link');
                        if (returnLink) {
                            returnLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                console.log('Powrót do archiwum.');
                                loadArchiveDefault(allPosts);
                            });
                        }
                        // Konfiguracja przycisków edycji
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
    };

    // Funkcja ładowania domyślnego widoku strony
    const loadDefaultView = async () => {
        postsList.innerHTML = '';
        postsLoading.classList.add('show');

        try {
            // Pobierz wszystkie posty
            const snapshot = await new Promise((resolve, reject) => {
                onValue(ref(db, 'posts'), (snap) => resolve(snap), { onlyOnce: true }, reject);
            });

            const posts = [];
            snapshot.forEach((child) => {
                posts.push({ id: child.key, ...child.val() });
            });

            console.log('Wszystkie posty z Firebase:', posts.length, posts.map(p => ({ title: p.title, createdAt: p.createdAt })));

            // Kolejkowanie pobierania
            const fetchedPosts = await fetchPostsInOrder(posts);

            // Najnowsze 3 posty
            const latestPosts = fetchedPosts.slice(0, 3);

            console.log('Najnowsze 3 posty:', latestPosts.length, latestPosts.map(p => ({ title: p.title, createdAt: p.createdAt })));

            if (latestPosts.length === 0) {
                postsList.innerHTML = '<p class="no-posts">Brak postów do wyświetlenia.</p>';
            } else {
                latestPosts.forEach((post) => {
                    const postDiv = document.createElement('div');
                    postDiv.className = 'post';
                    const { short, needsToggle } = truncateContent(post.content);
                    const shortContent = formatContent(short);
                    const fullContent = formatContent(post.content);
                    postDiv.innerHTML = `
                        <div class="post-meta">Opublikowano: ${post.postDate || 'Brak daty'} o ${post.postTime || 'Brak godziny'}</div>
                        <h3 class="post-title">${post.title || 'Bez tytułu'}</h3>
                        <div class="post-data"><strong>Data snu:</strong> ${post.dreamDate || 'Brak daty'}</div>
                        ${post.notes ? `<div class="post-notes"><strong>Uwagi:</strong> <span>${post.notes}</span></div>` : ''}
                        <div class="post-content">${shortContent}</div>
                        ${needsToggle ? `<div class="post-content-full">${fullContent}</div>` : ''}
                        ${needsToggle ? `<p><span class="content-toggle" data-toggle="expand">Rozwiń treść</span></p>` : ''}
                        ${needsToggle ? `<p class="content-collapse" style="display: none;"><span class="content-toggle" data-toggle="collapse">Zwiń treść</span></p>` : ''}
                        ${isAuthenticated ? `<button class="btn btn-edit" data-id="${post.id}">Edytuj</button>` : ''}
                    `;
                    postsList.appendChild(postDiv);

                    // Obsługa rozwijania/zwijania
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
                                expandLink.parentElement.style.display = 'block';
                                collapseP.style.display = 'none';
                                console.log(`Zwinięto treść posta: ${post.title}`);
                            });
                        }
                    }
                });

                // Obsługa edycji
                if (isAuthenticated) {
                    await setupEditButton();
                }
            }

            postsLoading.classList.remove('show');

            // Ładowanie archiwum
            loadArchiveDefault(fetchedPosts);
        } catch (error) {
            console.error('Błąd ładowania postów:', error);
            networkStatus.textContent = 'Błąd ładowania postów. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
            postsLoading.classList.remove('show');
        }
    };

    // Inicjalne ładowanie strony
    loadDefaultView();

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
        const postData = {
            title,
            dreamDate,
            notes: notes || null,
            content,
            postDate,
            postTime,
            createdAt: serverTimestamp()
        };
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
            console.log(postId ? 'Post zaktualizowany.' : 'Post zapisany.');
            await loadDefaultView(); // Odśwież widok
        } catch (error) {
            console.error('Błąd zapisu posta:', error);
            alert(`Błąd zapisu posta: ${error.message}`);
            networkStatus.textContent = 'Błąd zapisu posta. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
        }
    });
} catch (error) {
    console.error('Błąd inicjalizacji Firebase:', error);
    const networkStatus = document.getElementById('networkStatus');
    if (networkStatus) {
        networkStatus.textContent = 'Krytyczny błąd Firebase. Sprawdź konsolę.';
        networkStatus.style.display = 'block';
    }
}
