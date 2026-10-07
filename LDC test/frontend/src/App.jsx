import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Star, Search, User, Menu, X, Users, Lock, ChevronRight, Home, BarChart3, Target, Calendar, Activity } from 'lucide-react';
import * as Chart from 'chart.js/auto';

const API_URL = '/api';

export default function PredictChampions() {
  const [currentPage, setCurrentPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamTab, setTeamTab] = useState('joueurs');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [authStep, setAuthStep] = useState('choice');
  const [wantsPremium, setWantsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [countries, setCountries] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [topAssisters, setTopAssisters] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [predictions, setPredictions] = useState(null);

  const scorersChartRef = useRef(null);
  const assistersChartRef = useRef(null);
  const rankingsChartRef = useRef(null);
  const scorersChartInstance = useRef(null);
  const assistersChartInstance = useRef(null);
  const rankingsChartInstance = useRef(null);

  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  };

  useEffect(() => {
    loadInitialData();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      const userData = JSON.parse(user);
      setIsLoggedIn(true);
      setIsPremium(userData.is_premium);
      setCurrentUser(userData);
      setFavoriteTeam(userData.favoriteTeam || '');
      setFavoritePlayer(userData.favoritePlayer || '');
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [teamsData, countriesData, rankingsData, scorersData, assistersData] = await Promise.all([
        apiCall('/teams'),
        apiCall('/countries'),
        apiCall('/rankings/uefa?season=2024-2025'),
        apiCall('/players/top-scorers?season=2024-2025&limit=10'),
        apiCall('/players/top-assisters?season=2024-2025&limit=10')
      ]);

      setTeams(teamsData || []);
      setCountries(countriesData || []);
      setRankings(rankingsData || []);
      setTopScorers(scorersData || []);
      setTopAssisters(assistersData || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async () => {
    if (isLoggedIn && isPremium) {
      const data = await apiCall('/predictions/2025-2026');
      setPredictions(data);
    }
  };

  useEffect(() => {
    if (currentPage === 'predictions') {
      loadPredictions();
    }
  }, [currentPage, isLoggedIn, isPremium]);

  // Créer les graphiques Chart.js
  useEffect(() => {
    if (currentPage === 'records' && topScorers.length > 0 && topAssisters.length > 0) {
      // Graphique buteurs
      if (scorersChartRef.current) {
        if (scorersChartInstance.current) {
          scorersChartInstance.current.destroy();
        }
        scorersChartInstance.current = new Chart(scorersChartRef.current, {
          type: 'bar',
          data: {
            labels: topScorers.slice(0, 10).map(p => p.name),
            datasets: [{
              label: 'Buts',
              data: topScorers.slice(0, 10).map(p => p.goals),
              backgroundColor: 'rgba(236, 72, 153, 0.8)',
              borderColor: 'rgba(236, 72, 153, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { labels: { color: '#fff' } }
            },
            scales: {
              y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
              x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
            }
          }
        });
      }

      // Graphique passeurs
      if (assistersChartRef.current) {
        if (assistersChartInstance.current) {
          assistersChartInstance.current.destroy();
        }
        assistersChartInstance.current = new Chart(assistersChartRef.current, {
          type: 'bar',
          data: {
            labels: topAssisters.slice(0, 10).map(p => p.name),
            datasets: [{
              label: 'Passes',
              data: topAssisters.slice(0, 10).map(p => p.assists),
              backgroundColor: 'rgba(34, 211, 238, 0.8)',
              borderColor: 'rgba(34, 211, 238, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { labels: { color: '#fff' } }
            },
            scales: {
              y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
              x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
            }
          }
        });
      }
    }

    return () => {
      if (scorersChartInstance.current) scorersChartInstance.current.destroy();
      if (assistersChartInstance.current) assistersChartInstance.current.destroy();
    };
  }, [currentPage, topScorers, topAssisters]);

  // Graphique classement UEFA
  useEffect(() => {
    if (currentPage === 'classements' && rankings.length > 0) {
      if (rankingsChartRef.current) {
        if (rankingsChartInstance.current) {
          rankingsChartInstance.current.destroy();
        }
        rankingsChartInstance.current = new Chart(rankingsChartRef.current, {
          type: 'bar',
          data: {
            labels: rankings.slice(0, 10).map(r => r.team),
            datasets: [{
              label: 'Points UEFA',
              data: rankings.slice(0, 10).map(r => parseFloat(r.totalPoints)),
              backgroundColor: [
                'rgba(234, 179, 8, 0.8)', 'rgba(148, 163, 184, 0.8)', 'rgba(234, 88, 12, 0.8)',
                'rgba(59, 130, 246, 0.8)', 'rgba(34, 211, 238, 0.8)', 'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(34, 197, 94, 0.8)',
                'rgba(251, 146, 60, 0.8)'
              ],
              borderWidth: 2,
              borderColor: '#1e293b'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#fff' } }
            },
            scales: {
              y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
              x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
            }
          }
        });
      }
    }

    return () => {
      if (rankingsChartInstance.current) rankingsChartInstance.current.destroy();
    };
  }, [currentPage, rankings]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const results = await apiCall(`/teams/search/${query}`);
    setSearchResults(results || []);
  };

  const handleLogin = async () => {
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) return;

    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setIsLoggedIn(true);
      setIsPremium(data.user.is_premium);
      setCurrentUser(data.user);
      setFavoriteTeam(data.user.favoriteTeam || '');
      setFavoritePlayer(data.user.favoritePlayer || '');
      setAuthModal(null);
      setAuthStep('choice');
    } else {
      alert('Erreur de connexion');
    }
  };

  const handleRegister = async () => {
    const username = document.getElementById('reg-username')?.value;
    const email = document.getElementById('reg-email')?.value;
    const birthDate = document.getElementById('reg-birthdate')?.value;
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-confirm')?.value;
    const paysId = document.getElementById('reg-country')?.value;

    if (!username || !email || !birthDate || !password || !paysId) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirm) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nom: username,
        email,
        password,
        birthDate,
        paysId: parseInt(paysId),
        isPaying: wantsPremium,
        modePaiement: wantsPremium ? 'Lifetime' : null,
        favoriteTeam: '',
        favoritePlayer: ''
      })
    });

    if (data && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setIsLoggedIn(true);
      setIsPremium(data.user.is_premium);
      setCurrentUser(data.user);
      setAuthModal(null);
      setAuthStep('choice');
      setShowFavoritesModal(true);
    } else {
      alert('Erreur inscription');
    }
  };

  const updateFavorites = async () => {
    if (!favoriteTeam || !favoritePlayer) {
      alert('Sélectionnez une équipe et un joueur');
      return;
    }

    await apiCall('/users/favorites', {
      method: 'PUT',
      body: JSON.stringify({ favoriteTeam, favoritePlayer })
    });

    const user = JSON.parse(localStorage.getItem('user'));
    user.favoriteTeam = favoriteTeam;
    user.favoritePlayer = favoritePlayer;
    localStorage.setItem('user', JSON.stringify(user));
    setShowFavoritesModal(false);
  };

  const loadTeamData = async (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const [playersData, matchesData] = await Promise.all([
      apiCall(`/teams/${teamId}/players`),
      apiCall(`/teams/${team.name}/matches?season=2024-2025`)
    ]);

    setPlayers(playersData || []);
    setMatches(matchesData || []);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setIsPremium(false);
    setCurrentUser(null);
    setFavoriteTeam('');
    setFavoritePlayer('');
    setCurrentPage('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-cyan-400">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white rounded-full opacity-30"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animation: `twinkle ${2 + Math.random() * 3}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }`}</style>

      <header className="relative z-10 border-b border-blue-900/30 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div onClick={() => setCurrentPage('home')} className="flex items-center gap-3 cursor-pointer">
              <div className="w-16 h-16 bg-white rounded-lg p-2">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="30" cy="30" r="3" fill="#2D9B6B"/>
                  <line x1="30" y1="30" x2="30" y2="50" stroke="#2D9B6B" strokeWidth="2"/>
                  <circle cx="70" cy="50" r="20" fill="#2D9B6B"/>
                  <circle cx="70" cy="50" r="17" fill="white"/>
                  <polygon points="70,38 78,44 74,55 66,55 62,44" fill="#2D9B6B"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">PREDICTCHAMPIONS</h1>
                <p className="text-xs text-emerald-400">Vos pronostics, notre science</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => isLoggedIn ? setCurrentPage('account') : setAuthModal('login')} 
                className="p-2 hover:bg-slate-800/50 rounded-lg">
                <User className="w-5 h-5" />
              </button>
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 hover:bg-slate-800/50 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg">Menu Principal</h3>
              <button onClick={() => setMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-2">
              {[
                { icon: Home, label: 'Accueil', page: 'home' },
                { icon: BarChart3, label: 'Statistiques', page: 'records' },
                { icon: Lock, label: 'Prédictions', page: 'predictions' },
                { icon: Trophy, label: 'Équipes', page: 'championships' },
                { icon: Users, label: 'Classements', page: 'classements' },
                { icon: Star, label: 'Favoris', page: 'favorites' }
              ].map((item) => (
                <button key={item.page} onClick={() => { setCurrentPage(item.page); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-left">
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setAuthModal(null); setAuthStep('choice'); }}></div>
          <div className="relative bg-slate-900 rounded-2xl p-8 max-w-md w-full border border-cyan-500/30">
            <button onClick={() => { setAuthModal(null); setAuthStep('choice'); }} className="absolute top-4 right-4">
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-cyan-400">PREDICTCHAMPIONS</h2>

            {authStep === 'choice' && (
              <div className="space-y-4">
                <button onClick={() => setAuthStep('login')}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-semibold">
                  Connexion
                </button>
                <button onClick={() => setAuthStep('register')}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl font-semibold">
                  Inscription
                </button>
              </div>
            )}

            {authStep === 'login' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input type="email" id="login-email" placeholder="votre@email.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Mot de passe</label>
                  <input type="password" id="login-password" placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <button onClick={handleLogin}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-semibold">
                  Se Connecter
                </button>
                <div className="text-center pt-2">
                  <button onClick={() => setAuthStep('choice')} className="text-slate-400 text-sm hover:text-white">
                    ← Retour
                  </button>
                </div>
              </div>
            )}

            {authStep === 'register' && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Nom</label>
                  <input type="text" id="reg-username" placeholder="votre_pseudo" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input type="email" id="reg-email" placeholder="votre@email.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Date de naissance</label>
                  <input type="date" id="reg-birthdate" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Pays</label>
                  <select id="reg-country" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                    <option value="">Sélectionnez</option>
                    {countries.map(country => (
                      <option key={country.PaysId} value={country.PaysId}>{country.NomPays}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Mot de passe</label>
                  <input type="password" id="reg-password" placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Confirmer</label>
                  <input type="password" id="reg-confirm" placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
                </div>
                <div className="flex items-start gap-2">
                  <input type="checkbox" id="premium" checked={wantsPremium} onChange={(e) => setWantsPremium(e.target.checked)} className="w-4 h-4 mt-1" />
                  <label htmlFor="premium" className="text-sm text-slate-400">
                    Compte <span className="text-yellow-400 font-semibold">Premium</span> (49.99€ Lifetime)
                  </label>
                </div>
                <button onClick={handleRegister}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl font-semibold">
                  S'inscrire
                </button>
                <div className="text-center pt-2">
                  <button onClick={() => setAuthStep('choice')} className="text-slate-400 text-sm hover:text-white">
                    ← Retour
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFavoritesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70"></div>
          <div className="relative bg-slate-900 rounded-2xl p-8 max-w-md w-full border border-cyan-500/30">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Choisissez vos favoris</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Équipe Favorite</label>
                <select value={favoriteTeam} onChange={(e) => setFavoriteTeam(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <option value="">Sélectionnez</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Joueur Favori</label>
                <input type="text" value={favoritePlayer} onChange={(e) => setFavoritePlayer(e.target.value)}
                  placeholder="Nom du joueur" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" />
              </div>
              <button onClick={updateFavorites}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-semibold">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'home' && (
          <div className="space-y-6">
            <div className="relative max-w-2xl mb-8">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher un club..."
                className="w-full bg-slate-900/50 border border-blue-900/30 rounded-xl pl-12 pr-4 py-3.5 text-white" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 rounded-xl overflow-hidden z-50 border border-slate-700">
                  {searchResults.map((team) => (
                    <button key={team.id} onClick={() => { 
                      setSelectedTeam(team.id); 
                      loadTeamData(team.id);
                      setCurrentPage('team'); 
                      setSearchResults([]); 
                      setSearchQuery(''); 
                    }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 text-left">
                      <div className="flex-1">
                        <p className="font-semibold">{team.name}</p>
                        <p className="text-xs text-cyan-400">{team.points} pts</p>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isLoggedIn && favoriteTeam && (
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl p-6">
                <h3 className="font-bold mb-2">Mon Équipe: {favoriteTeam}</h3>
                <p className="text-sm">Joueur: {favoritePlayer}</p>
                <button onClick={() => setShowFavoritesModal(true)}
                  className="text-xs bg-black/20 px-3 py-1 rounded mt-2">
                  Modifier
                </button>
              </div>
            )}

            <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
              <h3 className="font-bold text-lg mb-4">🏆 Top Équipes par Points</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {teams.slice(0, 8).map((team, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    onClick={() => { setSelectedTeam(team); setCurrentPage('team'); }}>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-yellow-500 text-black' : 
                        i === 1 ? 'bg-slate-400 text-black' : 
                        i === 2 ? 'bg-orange-700 text-white' : 'bg-slate-700'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-semibold">{team.name}</span>
                        <p className="text-xs text-slate-400">{team.country}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold">{team.wins || 0} V</p>
                      <p className="text-xs text-slate-400">{team.matches_played || 0} M</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900/50 rounded-2xl border border-pink-500/30 p-6">
                <h3 className="font-bold text-lg mb-4 text-pink-400">⚽ Top 5 Buteurs</h3>
                <div className="space-y-3">
                  {topScorers.slice(0, 5).map((player, i) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-pink-400 font-bold text-lg">#{i + 1}</span>
                        <div>
                          <p className="font-semibold">{player.name}</p>
                          <p className="text-xs text-slate-400">{player.teamName || 'N/A'}</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-pink-400">{player.goals}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-2xl border border-cyan-500/30 p-6">
                <h3 className="font-bold text-lg mb-4 text-cyan-400">🎯 Top 5 Passeurs</h3>
                <div className="space-y-3">
                  {topAssisters.slice(0, 5).map((player, i) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-cyan-400 font-bold text-lg">#{i + 1}</span>
                        <div>
                          <p className="font-semibold">{player.name}</p>
                          <p className="text-xs text-slate-400">{player.teamName || 'N/A'}</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-cyan-400">{player.assists}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'records' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-8">📊 Statistiques 2024-2025</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
                <p className="text-4xl font-bold mb-2">{teams.length}</p>
                <p className="text-sm text-slate-400">Équipes en compétition</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-6 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-cyan-400" />
                <p className="text-4xl font-bold mb-2">{topScorers.length + topAssisters.length}</p>
                <p className="text-sm text-slate-400">Joueurs suivis</p>
              </div>
              <div className="bg-gradient-to-br from-pink-500/20 to-red-500/20 border border-pink-500/30 rounded-2xl p-6 text-center">
                <Target className="w-10 h-10 mx-auto mb-3 text-pink-400" />
                <p className="text-4xl font-bold mb-2">{topScorers.reduce((sum, p) => sum + (p.goals || 0), 0)}</p>
                <p className="text-sm text-slate-400">Buts marqués</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900/50 rounded-2xl border border-pink-500/30 p-6" style={{height: '500px'}}>
                <h3 className="font-bold text-lg mb-4 text-pink-400">⚽ Classement Buteurs</h3>
                <div style={{height: 'calc(100% - 40px)'}}>
                  <canvas ref={scorersChartRef}></canvas>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-2xl border border-cyan-500/30 p-6" style={{height: '500px'}}>
                <h3 className="font-bold text-lg mb-4 text-cyan-400">🎯 Classement Passeurs</h3>
                <div style={{height: 'calc(100% - 40px)'}}>
                  <canvas ref={assistersChartRef}></canvas>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-purple-500/30 p-6" style={{height: '500px'}}>
              <h3 className="font-bold text-lg mb-4 text-purple-400">🏆 Top 10 Classement UEFA</h3>
              <div style={{height: 'calc(100% - 40px)'}}>
                <canvas ref={rankingsChartRef}></canvas>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'classements' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-8">🏆 Classement UEFA 2024-2025</h2>
            
            <div className="bg-slate-900/50 rounded-xl p-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-cyan-400">#</th>
                    <th className="px-4 py-3 text-left text-cyan-400">Équipe</th>
                    <th className="px-4 py-3 text-center text-cyan-400">Pays</th>
                    <th className="px-4 py-3 text-right text-cyan-400">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                          i === 0 ? 'bg-yellow-500 text-black' :
                          i === 1 ? 'bg-slate-400 text-black' :
                          i === 2 ? 'bg-orange-700 text-white' : 'bg-slate-700'
                        }`}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.team}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-cyan-600/30 text-cyan-300 rounded text-xs">{r.country}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold">{r.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentPage === 'predictions' && (
          <div className="space-y-6">
            {!isLoggedIn || !isPremium ? (
              <div className="text-center max-w-3xl mx-auto">
                <Lock className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <h2 className="text-3xl font-bold mb-4">🔮 Prédictions Premium IA</h2>
                <p className="text-cyan-400 mb-6">
                  {!isLoggedIn ? 'Connectez-vous avec un compte Premium' : 'Passez Premium (49.99€)'}
                </p>
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl border border-purple-500/30 p-8">
                  <h3 className="font-bold text-xl mb-4">🤖 Contenu Premium Verrouillé</h3>
                  <p className="text-slate-400 mb-8">
                    Prédictions IA Machine Learning pour 2025-2026<br/>
                    Basées sur 10+ saisons de données
                  </p>
                  {!isLoggedIn ? (
                    <button onClick={() => setAuthModal('login')} 
                      className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 rounded-xl font-bold hover:scale-105 transition">
                      Se Connecter
                    </button>
                  ) : (
                    <button className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 rounded-xl font-bold hover:scale-105 transition">
                      ⭐ Passer Premium
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 rounded-full mb-4">
                    <Star className="w-5 h-5" fill="currentColor" />
                    <span className="font-bold text-slate-900">Premium Activé</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2">🔮 Prédictions IA 2025-2026</h2>
                  <p className="text-cyan-400">Machine Learning • 10+ saisons</p>
                </div>

                {predictions && predictions.predictions ? (
                  <div className="space-y-8">
                    <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-2xl border border-yellow-500/30 p-6 text-center">
                      <h3 className="text-2xl font-bold mb-2">🏆 Champion Prédit</h3>
                      <p className="text-4xl font-bold text-yellow-400">{predictions.champion}</p>
                      <p className="text-sm text-slate-400 mt-2">Basé sur {predictions.totalMatches} matchs</p>
                    </div>

                    {predictions.predictions.finale && (
                      <div className="bg-slate-900/50 rounded-2xl border border-purple-500/30 p-6">
                        <h3 className="font-bold text-xl mb-4 text-purple-400">🏆 FINALE</h3>
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-lg">{predictions.predictions.finale.team1}</span>
                            <span className="text-2xl font-bold text-cyan-400">{predictions.predictions.finale.score_prediction}</span>
                            <span className="font-bold text-lg">{predictions.predictions.finale.team2}</span>
                          </div>
                          <div className="text-center mt-3">
                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                              ✅ {predictions.predictions.finale.winner_prediction} • {predictions.predictions.finale.confidence}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {['huitiemes', 'quarts', 'demiFinales'].map((phase) => {
                      const phaseData = predictions.predictions[phase];
                      const phaseName = phase === 'huitiemes' ? '🥇 Huitièmes' : phase === 'quarts' ? '🥈 Quarts' : '🥉 Demi-finales';
                      
                      if (!phaseData || phaseData.length === 0) return null;

                      return (
                        <div key={phase} className="bg-slate-900/50 rounded-2xl border border-cyan-500/30 p-6">
                          <h3 className="font-bold text-xl mb-4 text-cyan-400">{phaseName}</h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {phaseData.map((match, i) => (
                              <div key={i} className="bg-slate-800/50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-sm">{match.team1}</span>
                                  <span className="font-bold text-cyan-400">VS</span>
                                  <span className="font-semibold text-sm">{match.team2}</span>
                                </div>
                                {match.match_aller && (
                                  <div className="text-xs text-slate-400 space-y-1">
                                    <p>Aller: {match.match_aller}</p>
                                    <p>Retour: {match.match_retour}</p>
                                    <p className="font-bold text-cyan-300">Total: {match.score_prediction}</p>
                                  </div>
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-sm">✅ {match.winner_prediction}</span>
                                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                    {match.confidence}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-2xl border border-cyan-500/30 p-8 text-center">
                    <Activity className="w-16 h-16 mx-auto mb-4 text-cyan-400 animate-pulse" />
                    <h3 className="font-bold text-xl mb-4">🔮 Prédictions Python IA</h3>
                    <p className="text-slate-400 mb-4">
                      Exécutez <code className="bg-slate-800 px-2 py-1 rounded">python predictions.py</code>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentPage === 'favorites' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-8">⭐ Mes Favoris</h2>
            {isLoggedIn ? (
              favoriteTeam ? (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-2xl">🏆 {favoriteTeam}</h3>
                      <button onClick={() => setShowFavoritesModal(true)}
                        className="px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg text-sm font-semibold">
                        ✏️ Modifier
                      </button>
                    </div>
                    <p className="text-lg">⭐ Joueur: {favoritePlayer}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Star className="w-20 h-20 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 mb-6">Aucun favori défini</p>
                  <button onClick={() => setShowFavoritesModal(true)}
                    className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-semibold hover:scale-105 transition">
                    Définir mes favoris
                  </button>
                </div>
              )
            ) : (
              <div className="text-center">
                <Lock className="w-20 h-20 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 mb-6">Connectez-vous</p>
                <button onClick={() => setAuthModal('login')}
                  className="px-8 py-3 bg-blue-600 rounded-xl font-semibold">
                  Se Connecter
                </button>
              </div>
            )}
          </div>
        )}

        {currentPage === 'account' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-8">👤 Mon Compte</h2>
            {isLoggedIn ? (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-cyan-500/30">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-4xl font-bold">
                      {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-1">{currentUser?.username || 'Utilisateur'}</h3>
                      <p className="text-slate-400 mb-4">{currentUser?.email}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isPremium ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                        {isPremium ? '⭐ Premium' : '🆓 Gratuit'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-red-500/30">
                  <h3 className="font-bold text-lg mb-4 text-red-400">⚠️ Zone de Danger</h3>
                  <button onClick={handleLogout}
                    className="w-full py-3 bg-red-600/20 text-red-400 rounded-xl font-semibold hover:bg-red-600/30 border border-red-500/50 transition">
                    Se Déconnecter
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <User className="w-20 h-20 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 mb-6">Non connecté</p>
                <button onClick={() => setAuthModal('login')} className="px-8 py-3 bg-blue-600 rounded-xl font-semibold">
                  Se Connecter
                </button>
              </div>
            )}
          </div>
        )}

        {currentPage === 'team' && selectedTeam && (
          <div className="space-y-6">
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Retour
            </button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">{selectedTeam.name}</h2>
              <p className="text-slate-400">{selectedTeam.country}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 rounded-xl p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
                <p className="text-3xl font-bold mb-2">{selectedTeam.wins || 0}</p>
                <p className="text-sm text-slate-400">Victoires</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-6 text-center">
                <Target className="w-10 h-10 mx-auto mb-3 text-cyan-400" />
                <p className="text-3xl font-bold mb-2">{selectedTeam.shots || 0}</p>
                <p className="text-sm text-slate-400">Tirs</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-6 text-center">
                <Calendar className="w-10 h-10 mx-auto mb-3 text-pink-400" />
                <p className="text-3xl font-bold mb-2">{selectedTeam.matches_played || 0}</p>
                <p className="text-sm text-slate-400">Matchs</p>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'championships' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-8">🏆 Toutes les Équipes</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {teams.map((team, i) => (
                <div key={i} onClick={() => { setSelectedTeam(team); setCurrentPage('team'); }}
                  className="bg-slate-800/50 rounded-xl p-4 hover:border hover:border-cyan-500 cursor-pointer transition hover:scale-105">
                  <p className="font-semibold text-lg">{team.name}</p>
                  <p className="text-xs text-cyan-400">{team.wins || 0} V • {team.country}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}