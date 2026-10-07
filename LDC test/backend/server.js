// server.js - Backend PredictChampions MySQL
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable is required`);
  return value;
};
const JWT_SECRET = requiredEnv('JWT_SECRET');

// Middleware
app.use(cors());
app.use(express.json());

// Connexion MySQL
const pool = mysql.createPool({
  host: requiredEnv('DB_HOST'),
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),
  port: Number(requiredEnv('DB_PORT')),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connexion
try {
  const [rows] = await pool.query('SELECT NOW() AS now');
  console.log('✅ MySQL connecté:', rows[0].now);
} catch (err) {
  console.error('❌ Erreur MySQL:', err);
}

// Middleware authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requis' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

// ==================== AUTHENTIFICATION ====================

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nom, email, password, birthDate, favoriteTeam, favoritePlayer, isPaying, modePaiement, rib, paysId } = req.body;

    const [existing] = await pool.query('SELECT * FROM Subscriber WHERE email = ? OR nom = ?', [email, nom]);
    if (existing.length > 0) return res.status(400).json({ error: 'Utilisateur déjà existant' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO Subscriber (nom, email, password, birthDate, favoriteTeam, favoritePlayer, dateInscription, is_paying, ModePaiement, RIB, PaysId)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [nom, email, hashedPassword, birthDate, favoriteTeam || '', favoritePlayer || '', isPaying ? 'Y' : 'N', modePaiement || null, rib || null, paysId]
    );

    const token = jwt.sign(
      { id: result.insertId, username: nom, isPremium: isPaying },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: result.insertId,
        username: nom,
        email,
        is_premium: isPaying,
        favoriteTeam: favoriteTeam || '',
        favoritePlayer: favoritePlayer || ''
      },
      token
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM Subscriber WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants incorrects' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    const token = jwt.sign(
      { id: user.Abonne_Id, username: user.nom, isPremium: user.is_paying === 'Y' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.Abonne_Id,
        username: user.nom,
        email: user.email,
        is_premium: user.is_paying === 'Y',
        favoriteTeam: user.favoriteTeam,
        favoritePlayer: user.favoritePlayer
      },
      token
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir utilisateur connecté
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT Abonne_Id, nom, email, is_paying, favoriteTeam, favoritePlayer, birthDate FROM Subscriber WHERE Abonne_Id = ?',
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const user = rows[0];
    res.json({
      id: user.Abonne_Id,
      username: user.nom,
      email: user.email,
      is_premium: user.is_paying === 'Y',
      favoriteTeam: user.favoriteTeam,
      favoritePlayer: user.favoritePlayer,
      birthDate: user.birthDate
    });
  } catch (err) {
    console.error('Erreur récupération utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ÉQUIPES ====================

// Toutes les équipes (utilise les VRAIES colonnes de votre BDD)
app.get('/api/teams', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        nom_equipe as name,
        pays_equipe as country,
        nb_matchs_joues as matches_played,
        nb_victoires as wins,
        nb_matchs_nuls as draws,
        nb_defaites as losses,
        nb_tirs as shots,
        nb_tirs_cadrees as shots_on_target,
        saison as season
      FROM Team
      WHERE saison = '2024-2025'
      ORDER BY nb_victoires DESC
      LIMIT 50
    `);
    console.log(`✅ ${rows.length} équipes récupérées`);
    res.json(rows);
  } catch (err) {
    console.error('❌ Erreur équipes:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});



app.get('/api/teams/search/:query', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         nom_equipe AS name, 
         pays_equipe AS country
       FROM Team
       WHERE LOWER(nom_equipe) LIKE LOWER(?)
         AND saison = "2024-2025"
       LIMIT 10`,
      [`%${req.params.query}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur recherche:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== JOUEURS ====================

// Joueurs d'une équipe
app.get('/api/teams/:teamId/players', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        PlayerId as id,
        PlayerName as name,
        TeamId as team_id,
        PlayerClubJerseyNumber as jersey_number,
        PlayerFieldPosition as position,
        PlayerAge as age,
        PlayerCountryName as nationality,
        goals,
        assists,
        matchesappearance as matches_played,
        saison as season
      FROM Player
      WHERE TeamId = ? AND saison = '2024-2025'
      ORDER BY goals DESC`,
      [req.params.teamId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur joueurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Top buteurs
app.get('/api/players/top-scorers', async (req, res) => {
  try {
    const season = req.query.season || '2024-2025';
    const limit = parseInt(req.query.limit) || 10;
    const [rows] = await pool.query(
      `SELECT 
        p.PlayerId as id,
        p.PlayerName as name,
        p.goals,
        p.matchesappearance as matches,
        p.PlayerFieldPosition as position,
        p.PlayerAge as age,
        t.nom_equipe as teamName
      FROM Player p
      LEFT JOIN Team t ON p.TeamDisplayName = t.nom_equipe AND t.saison = p.saison
      WHERE p.goals > 0 AND p.saison = ?
      ORDER BY p.goals DESC
      LIMIT ?`,
      [season, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur top buteurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Top passeurs
app.get('/api/players/top-assisters', async (req, res) => {
  try {
    const season = req.query.season || '2024-2025';
    const limit = parseInt(req.query.limit) || 10;
    const [rows] = await pool.query(
      `SELECT 
        p.PlayerId as id,
        p.PlayerName as name,
        p.assists,
        p.matchesappearance as matches,
        p.PlayerFieldPosition as position,
        p.PlayerAge as age,
        t.nom_equipe as teamName
      FROM Player p
      LEFT JOIN Team t ON p.TeamDisplayName = t.nom_equipe AND t.saison = p.saison
      WHERE p.assists > 0 AND p.saison = ?
      ORDER BY p.assists DESC
      LIMIT ?`,
      [season, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur top passeurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== MATCHS ====================

// Matchs d'une équipe
app.get('/api/teams/:teamName/matches', async (req, res) => {
  try {
    const season = req.query.season || '2024-2025';
    const [rows] = await pool.query(
      `SELECT 
        Date as date,
        HomeTeam as homeTeam,
        AwayTeam as awayTeam,
        ScoreHome as scoreHome,
        ScoreAway as scoreAway,
        Saison as season
      FROM Score
      WHERE (HomeTeam = ? OR AwayTeam = ?) AND Saison = ?
      ORDER BY Date DESC`,
      [req.params.teamName, req.params.teamName, season]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur matchs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== CLASSEMENTS ====================

// Classement UEFA
app.get('/api/rankings/uefa', async (req, res) => {
  try {
    const season = req.query.season || '2024-2025';
    const [rows] = await pool.query(
      `SELECT 
        equipe as team,
        codePays as country,
        TotalPoints as totalPoints,
        CountryPart as countryCoefficient,
        saison as season
      FROM Ranking
      WHERE saison = ?
      ORDER BY CAST(TotalPoints AS DECIMAL(10,2)) DESC`,
      [season]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur classement UEFA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Stats par pays
app.get('/api/rankings/countries', async (req, res) => {
  try {
    const season = req.query.season || '2024-2025';
    const [rows] = await pool.query(
      `SELECT 
        c.CodeISO as code,
        c.NomPays as name,
        COUNT(DISTINCT r.equipe) as teams_count,
        SUM(CAST(r.TotalPoints AS DECIMAL(10,2))) as total_points,
        AVG(CAST(r.CountryPart AS DECIMAL(10,2))) as coefficient
      FROM Country c
      LEFT JOIN Ranking r ON c.CodeISO = r.codePays AND r.saison = ?
      GROUP BY c.CodeISO, c.NomPays
      ORDER BY coefficient DESC`,
      [season]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur stats pays:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== PAYS ====================

// Tous les pays
app.get('/api/countries', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT PaysId, NomPays, CodeISO FROM Country ORDER BY NomPays');
    res.json(rows);
  } catch (err) {
    console.error('Erreur pays:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== FAVORIS ====================

// Obtenir favoris
app.get('/api/users/favorites', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT favoriteTeam, favoritePlayer FROM Subscriber WHERE Abonne_Id = ?',
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Erreur favoris:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour favoris
app.put('/api/users/favorites', authenticateToken, async (req, res) => {
  try {
    const { favoriteTeam, favoritePlayer } = req.body;
    await pool.query(
      'UPDATE Subscriber SET favoriteTeam = ?, favoritePlayer = ? WHERE Abonne_Id = ?',
      [favoriteTeam, favoritePlayer, req.user.id]
    );
    res.json({ favoriteTeam, favoritePlayer });
  } catch (err) {
    console.error('Erreur MAJ favoris:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== PRÉDICTIONS ====================

// Upload prédictions (depuis Python)
app.post('/api/predictions/upload', authenticateToken, async (req, res) => {
  try {
    const { season, predictions } = req.body;
    
    if (!predictions || predictions.length === 0) {
      return res.status(400).json({ error: 'Aucune prédiction fournie' });
    }

    // Supprimer anciennes prédictions
    await pool.query('DELETE FROM Predictions WHERE saison = ?', [season]);

    // Insérer nouvelles prédictions
    for (const pred of predictions) {
      await pool.query(
        `INSERT INTO Predictions (saison, phase, team1, team2, score_prediction, winner_prediction, confidence, match_aller, match_retour)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          season,
          pred.phase,
          pred.team1,
          pred.team2,
          pred.score_total || pred.score,
          pred.winner,
          pred.confidence,
          pred.match_aller || null,
          pred.match_retour || null
        ]
      );
    }

    res.json({ success: true, message: `${predictions.length} prédictions enregistrées` });
  } catch (err) {
    console.error('Erreur upload prédictions:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Obtenir prédictions (Premium only)
app.get('/api/predictions/:season', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isPremium) {
      return res.status(403).json({ error: 'Accès Premium requis' });
    }

    const { season } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM Predictions WHERE saison = ? ORDER BY 
       CASE phase
         WHEN 'Huitièmes de finale' THEN 1
         WHEN 'Quarts de finale' THEN 2
         WHEN 'Demi-finales' THEN 3
         WHEN 'Finale' THEN 4
       END`,
      [season]
    );

    if (rows.length === 0) {
      return res.json({
        season,
        predictions: [],
        message: 'Aucune prédiction disponible'
      });
    }

    const groupedPredictions = {
      huitiemes: rows.filter(p => p.phase === 'Huitièmes de finale'),
      quarts: rows.filter(p => p.phase === 'Quarts de finale'),
      demiFinales: rows.filter(p => p.phase === 'Demi-finales'),
      finale: rows.find(p => p.phase === 'Finale')
    };

    res.json({
      season,
      predictions: groupedPredictions,
      totalMatches: rows.length,
      champion: groupedPredictions.finale?.winner_prediction || 'À déterminer'
    });
  } catch (err) {
    console.error('Erreur prédictions:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API PredictChampions', database: 'MySQL Connected' });
});

// ==================== SERVIR FRONTEND ====================

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ==================== DÉMARRAGE ====================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 Serveur PredictChampions démarré                      ║
║  📡 Port: ${PORT}                                             ║
║  🔗 API: http://localhost:${PORT}                            ║
║  💾 Base de données: MySQL Connectée                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});