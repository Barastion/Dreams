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

    // Funkcja formatowania treści z zachowaniem akapitów i pustych linii
    const formatContent = (content) => {
        if (!content) return 'Brak treści';
        return content
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
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
        console.log(postId ? 'Otwarto formularz edycji.' : 'Otwarto formularz dodawania.');
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
            adminModal.style.display = 'none';
            postModal.style.display = 'none';
        }
    });

    // Flaga zapobiegająca wielokrotnemu renderowaniu
    let isRenderingPosts = false;
    let isRenderingArchive = false;

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
                    <span>${post.title || 'Bez tytułu'} - Opublikowano ${post.postDate || 'Brak daty'}</span>
                    <span class="expand-arrow">▼</span>
                `;
                archiveItem.addEventListener('click', () => {
                    onValue(ref(db, `posts/${post.id}`), (snapshot) => {
                        const fullPost = snapshot.val();
                        archiveList.innerHTML = `
                            <div class="post">
                                <div class="post-meta">Opublikowano: ${fullPost.postDate || 'Brak daty'} o ${fullPost.postTime || 'Brak godziny'}</div>
                                <h3 class="post-title">${fullPost.title || 'Bez tytułu'}</h3>
                                <div class="post-data"><strong>Data snu:</strong> ${fullPost.dreamDate || 'Brak daty'}</div>
                                ${fullPost.notes ? `<div class="post-notes"><strong>Uwagi:</strong> <span>${fullPost.notes}</span></div>` : ''}
                                <div class="post-content">${formatContent(fullPost.content)}</div>
                                ${isAuthenticated ? `<button class="btn btn-edit" data-id="${post.id}">Edytuj</button>` : ''}
                                <p><span class="return-link">Powrót do strony głównej</span></p>
                            </div>
                        `;
                        // Ponowne przypisanie obsługi edycji
                        if (isAuthenticated) {
                            const editButton = document.querySelector('.btn-edit');
                            if (editButton) {
                                editButton.addEventListener('click', () => {
                                    openPostModal(post.id, fullPost);
                                });
                            }
                        }
                        // Obsługa powrotu do strony głównej
                        const returnLink = document.querySelector('.return-link');
                        if (returnLink) {
                            returnLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                loadDefaultView();
                            });
                        }
                    }, { onlyOnce: true });
                });
                archiveList.appendChild(archiveItem);
            });
        }

        archiveLoading.classList.remove('show');
    };

    // Funkcja ładowania domyślnego widoku strony
    const loadDefaultView = () => {
        // Ładowanie najnowszych postów
        onValue(ref(db, 'posts'), (snapshot) => {
            if (isRenderingPosts) {
                console.log('Pomijanie renderowania postów - już w trakcie.');
                return;
            }
            isRenderingPosts = true;

            postsList.innerHTML = '';
            postsLoading.classList.add('show');

            const posts = [];
            snapshot.forEach((child) => {
                posts.push({ id: child.key, ...child.val() });
            });

            console.log('Wszystkie posty z Firebase:', posts.length, posts.map(p => ({ title: p.title, createdAt: p.createdAt })));

            // Sortowanie i ograniczenie do 3 najnowszych
            const latestPosts = posts
                .filter(post => post.createdAt)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 3);

            console.log('Najnowsze 3 posty:', latestPosts.length, latestPosts.map(p => ({ title: p.title, createdAt: p.createdAt })));

            if (latestPosts.length === 0) {
                postsList.innerHTML = '<p class="no-posts">Brak postów do wyświetlenia.</p>';
            } else {
                latestPosts.forEach((post) => {
                    const postDiv = document.createElement('div');
                    postDiv.className = 'post';
                    postDiv.innerHTML = `
                        <div class="post-meta">Opublikowano: ${post.postDate || 'Brak daty'} o ${post.postTime || 'Brak godziny'}</div>
                        <h3 class="post-title">${post.title || 'Bez tytułu'}</h3>
                        <div class="post-data"><strong>Data snu:</strong> ${post.dreamDate || 'Brak daty'}</div>
                        ${post.notes ? `<div class="post-notes"><strong>Uwagi:</strong> <span>${post.notes}</span></div>` : ''}
                        <div class="post-content">${formatContent(post.content)}</div>
                        ${isAuthenticated ? `<button class="btn btn-edit" data-id="${post.id}">Edytuj</button>` : ''}
                    `;
                    postsList.appendChild(postDiv);
                });
                // Dodanie obsługi edycji
                document.querySelectorAll('.btn-edit').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const postId = e.target.dataset.id;
                        onValue(ref(db, `posts/${postId}`), (snapshot) => {
                            const postData = snapshot.val();
                            openPostModal(postId, postData);
                        }, { onlyOnce: true });
                    });
                });
            }

            postsLoading.classList.remove('show');
            isRenderingPosts = false;

            // Ładowanie archiwum
            loadArchiveDefault(posts);
        }, (error) => {
            console.error('Błąd ładowania postów:', error);
            networkStatus.textContent = 'Błąd ładowania postów. Sprawdź konsolę.';
            networkStatus.style.display = 'block';
            postsLoading.classList.remove('show');
            isRenderingPosts = false;
        });
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
            loadDefaultView(); // Odśwież widok po zapisie
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
