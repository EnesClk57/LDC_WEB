# -*- coding: utf-8 -*-
"""
Prédictions LDC 2025-2026 avec Machine Learning Avancé
Auteur : Amélioration par IA
Utilise 10+ saisons de données historiques (2014-2025)
"""

import os
from pathlib import Path

import pandas as pd
import numpy as np
from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import warnings
warnings.filterwarnings('ignore')

# ======================================
# 1. Connexion à la base SQL
# ======================================
load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")
USER = os.environ["DB_USER"]
PASSWORD = os.environ["DB_PASSWORD"]
HOST = os.environ["DB_HOST"]
PORT = int(os.environ["DB_PORT"])
DBNAME = os.environ["DB_NAME"]

engine = create_engine(URL.create(
    "mysql+pymysql",
    username=USER,
    password=PASSWORD,
    host=HOST,
    port=PORT,
    database=DBNAME,
))

print(" Chargement des données historiques...")

# ======================================
# 2. Chargement de TOUTES les données historiques
# ======================================
# Charger toutes les saisons disponibles
team_stats_all = pd.read_sql("SELECT * FROM Team", engine)
player_stats_all = pd.read_sql("SELECT * FROM Player", engine)
score_all = pd.read_sql("SELECT * FROM Score", engine)
ranking_all = pd.read_sql("SELECT * FROM Ranking", engine)

print(f" {len(team_stats_all)} lignes d'équipes chargées")
print(f" {len(player_stats_all)} lignes de joueurs chargées")
print(f" {len(score_all)} matchs historiques chargés")
print(f" Saisons disponibles: {sorted(team_stats_all['saison'].unique())}")

# ======================================
# 3. Feature Engineering Avancé
# ======================================
def create_advanced_features(team_name, season, team_df, player_df, score_df, ranking_df):
    """
    Crée des features avancées pour une équipe
    """
    features = {}
    
    # --- FEATURES ÉQUIPE ACTUELLE ---
    team_current = team_df[(team_df['nom_equipe'] == team_name) & (team_df['saison'] == season)]
    
    if not team_current.empty:
        team_row = team_current.iloc[0]
        features['nb_matchs_joues'] = team_row.get('nb_matchs_joues', 0)
        features['nb_victoires'] = team_row.get('nb_victoires', 0)
        features['nb_matchs_nuls'] = team_row.get('nb_matchs_nuls', 0)
        features['nb_defaites'] = team_row.get('nb_defaites', 0)
        features['nb_tirs_cadrees'] = team_row.get('nb_tirs_cadrees', 0)
        features['nb_tirs_non_cadrees'] = team_row.get('nb_tirs_non_cadrees', 0)
        features['nb_tirs_bloquees'] = team_row.get('nb_tirs_bloquees', 0)
        
        # Ratios et métriques calculées
        total_matchs = features['nb_matchs_joues'] if features['nb_matchs_joues'] > 0 else 1
        features['win_rate'] = features['nb_victoires'] / total_matchs
        features['draw_rate'] = features['nb_matchs_nuls'] / total_matchs
        features['loss_rate'] = features['nb_defaites'] / total_matchs
        
        total_tirs = features['nb_tirs_cadrees'] + features['nb_tirs_non_cadrees']
        features['tirs_precision'] = features['nb_tirs_cadrees'] / total_tirs if total_tirs > 0 else 0
        features['tirs_total'] = total_tirs
    else:
        # Valeurs par défaut
        for key in ['nb_matchs_joues', 'nb_victoires', 'nb_matchs_nuls', 'nb_defaites',
                    'nb_tirs_cadrees', 'nb_tirs_non_cadrees', 'nb_tirs_bloquees',
                    'win_rate', 'draw_rate', 'loss_rate', 'tirs_precision', 'tirs_total']:
            features[key] = 0
    
    # --- FEATURES JOUEURS ---
    players_current = player_df[(player_df['TeamDisplayName'] == team_name) & (player_df['saison'] == season)]
    
    if not players_current.empty:
        features['total_goals'] = players_current['goals'].sum()
        features['total_assists'] = players_current['assists'].sum()
        features['avg_goals_per_player'] = players_current['goals'].mean()
        features['max_goals_player'] = players_current['goals'].max()
        features['total_matches_appearance'] = players_current['matchesappearance'].sum()
        features['avg_distance'] = players_current['distancecovered'].mean() if 'distancecovered' in players_current.columns else 0
        features['avg_topspeed'] = players_current['topspeed'].mean() if 'topspeed' in players_current.columns else 0
    else:
        for key in ['total_goals', 'total_assists', 'avg_goals_per_player', 'max_goals_player',
                    'total_matches_appearance', 'avg_distance', 'avg_topspeed']:
            features[key] = 0
    
    # --- HISTORIQUE PERFORMANCES (3 dernières saisons) ---
    available_seasons = sorted(team_df['saison'].unique())
    current_season_idx = available_seasons.index(season) if season in available_seasons else -1
    
    if current_season_idx > 0:
        past_seasons = available_seasons[max(0, current_season_idx-3):current_season_idx]
        past_teams = team_df[(team_df['nom_equipe'] == team_name) & (team_df['saison'].isin(past_seasons))]
        
        if not past_teams.empty:
            features['avg_wins_3seasons'] = past_teams['nb_victoires'].mean()
            features['avg_goals_3seasons'] = past_teams.apply(
                lambda row: player_df[(player_df['TeamDisplayName'] == team_name) & 
                                     (player_df['saison'] == row['saison'])]['goals'].sum(), axis=1
            ).mean()
        else:
            features['avg_wins_3seasons'] = 0
            features['avg_goals_3seasons'] = 0
    else:
        features['avg_wins_3seasons'] = 0
        features['avg_goals_3seasons'] = 0
    
    # --- HISTORIQUE MATCHS (Head-to-Head) ---
    team_matches = score_df[(score_df['HomeTeam'] == team_name) | (score_df['AwayTeam'] == team_name)]
    
    if not team_matches.empty:
        # Victoires historiques
        home_wins = ((team_matches['HomeTeam'] == team_name) & 
                     (team_matches['ScoreHome'] > team_matches['ScoreAway'])).sum()
        away_wins = ((team_matches['AwayTeam'] == team_name) & 
                     (team_matches['ScoreAway'] > team_matches['ScoreHome'])).sum()
        features['historical_wins'] = home_wins + away_wins
        features['historical_matches'] = len(team_matches)
        features['historical_win_rate'] = features['historical_wins'] / features['historical_matches']
        
        # Moyenne buts marqués/encaissés
        goals_scored = []
        goals_conceded = []
        for _, match in team_matches.iterrows():
            if match['HomeTeam'] == team_name:
                goals_scored.append(match['ScoreHome'])
                goals_conceded.append(match['ScoreAway'])
            else:
                goals_scored.append(match['ScoreAway'])
                goals_conceded.append(match['ScoreHome'])
        
        features['avg_goals_scored_historical'] = np.mean(goals_scored) if goals_scored else 0
        features['avg_goals_conceded_historical'] = np.mean(goals_conceded) if goals_conceded else 0
        features['goal_difference_historical'] = features['avg_goals_scored_historical'] - features['avg_goals_conceded_historical']
    else:
        for key in ['historical_wins', 'historical_matches', 'historical_win_rate',
                    'avg_goals_scored_historical', 'avg_goals_conceded_historical', 'goal_difference_historical']:
            features[key] = 0
    
    # --- COEFFICIENT UEFA / RANKING ---
    team_ranking = ranking_df[(ranking_df['equipe'] == team_name) & (ranking_df['saison'] == season)]
    
    if not team_ranking.empty:
        features['uefa_points'] = float(team_ranking.iloc[0]['TotalPoints'])
        features['country_coefficient'] = float(team_ranking.iloc[0]['CountryPart'])
    else:
        features['uefa_points'] = 0
        features['country_coefficient'] = 0
    
    return features

# ======================================
# 4. Création du dataset d'entraînement
# ======================================
print("\n Création du dataset d'entraînement...")

training_data = []

# Pour chaque match historique, créer les features des 2 équipes
for _, match in score_all.iterrows():
    team1 = match['HomeTeam']
    team2 = match['AwayTeam']
    season = match['Saison']
    
    # Features équipe 1
    features1 = create_advanced_features(team1, season, team_stats_all, player_stats_all, score_all, ranking_all)
    
    # Features équipe 2
    features2 = create_advanced_features(team2, season, team_stats_all, player_stats_all, score_all, ranking_all)
    
    # Différence de features (équipe1 - équipe2)
    diff_features = {f'diff_{key}': features1.get(key, 0) - features2.get(key, 0) 
                     for key in features1.keys()}
    
    # Label : 1 si équipe1 gagne, 0 si nul, -1 si équipe2 gagne
    if match['ScoreHome'] > match['ScoreAway']:
        label = 1
    elif match['ScoreHome'] < match['ScoreAway']:
        label = -1
    else:
        label = 0
    
    # Ajouter au dataset
    training_data.append({**diff_features, 'label': label, 
                         'score1': match['ScoreHome'], 'score2': match['ScoreAway']})

df_train = pd.DataFrame(training_data)

# Nettoyer les valeurs NaN/inf
df_train = df_train.replace([np.inf, -np.inf], 0).fillna(0)

print(f" Dataset créé: {len(df_train)} matchs d'entraînement")
print(f"   Distribution: Victoires={len(df_train[df_train['label']==1])}, "
      f"Nuls={len(df_train[df_train['label']==0])}, "
      f"Défaites={len(df_train[df_train['label']==-1])}")

# ======================================
# 5. Entraînement du modèle ML
# ======================================
print("\n Entraînement du modèle de Machine Learning...")

# Préparer X et y
feature_cols = [col for col in df_train.columns if col.startswith('diff_')]
X_train = df_train[feature_cols]
y_train = df_train['label']

# Normalisation
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

# Modèle : Gradient Boosting (meilleur pour les prédictions de compétitions)
model = GradientBoostingClassifier(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)

# Entraînement
model.fit(X_train_scaled, y_train)

# Validation croisée
cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='accuracy')
print(f" Modèle entraîné - Précision moyenne (CV): {cv_scores.mean()*100:.2f}% (+/- {cv_scores.std()*100:.2f}%)")

# Feature importance
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False).head(10)

print("\n Top 10 Features les plus importantes:")
print(feature_importance.to_string(index=False))

# ======================================
# 6. Prédiction améliorée avec ML
# ======================================
def predict_match_ml(team1, team2, season):
    """
    Prédit le résultat d'un match avec ML
    """
    # Créer les features
    features1 = create_advanced_features(team1, season, team_stats_all, player_stats_all, score_all, ranking_all)
    features2 = create_advanced_features(team2, season, team_stats_all, player_stats_all, score_all, ranking_all)
    
    # Différence de features
    diff_features = {f'diff_{key}': features1.get(key, 0) - features2.get(key, 0) 
                     for key in features1.keys()}
    
    # Créer DataFrame
    X_pred = pd.DataFrame([diff_features])[feature_cols]
    X_pred = X_pred.replace([np.inf, -np.inf], 0).fillna(0)
    X_pred_scaled = scaler.transform(X_pred)
    
    # Prédiction
    prediction = model.predict(X_pred_scaled)[0]
    proba = model.predict_proba(X_pred_scaled)[0]
    
    # Prédire les scores basés sur historique + ML
    historical_avg1 = features1.get('avg_goals_scored_historical', 1.5)
    historical_avg2 = features2.get('avg_goals_scored_historical', 1.5)
    
    # Ajuster selon la prédiction ML
    if prediction == 1:  # Team1 gagne
        score1 = np.random.poisson(historical_avg1 * 1.2)
        score2 = np.random.poisson(historical_avg2 * 0.8)
    elif prediction == -1:  # Team2 gagne
        score1 = np.random.poisson(historical_avg1 * 0.8)
        score2 = np.random.poisson(historical_avg2 * 1.2)
    else:  # Match nul
        score1 = np.random.poisson(historical_avg1)
        score2 = np.random.poisson(historical_avg2)
    
    confidence = max(proba) * 100
    
    return score1, score2, confidence

# ======================================
# 7. Simulation du tournoi 2025-2026
# ======================================
print("\n🏆 Simulation LDC 2025-2026...")

# Récupérer les équipes qualifiées
teams_2025 = team_stats_all[team_stats_all['saison'] == '2025-2026']['nom_equipe'].tolist()

if len(teams_2025) < 16:
    print(f" Seulement {len(teams_2025)} équipes trouvées, complétion avec les meilleures équipes historiques...")
    # Compléter avec les meilleures équipes selon coefficient UEFA
    best_teams = ranking_all.sort_values('TotalPoints', ascending=False)['equipe'].unique()[:16]
    teams_2025 = list(set(teams_2025 + list(best_teams)))[:16]

teams_2025 = teams_2025[:16]
print(f"✅ 16 équipes qualifiées: {', '.join(teams_2025)}")

def simulate_round_ml(teams, round_name):
    """Simule un tour avec ML"""
    winners = []
    results = []
    
    print(f"\n {round_name}")
    print("=" * 60)
    
    for i in range(0, len(teams), 2):
        team1 = teams[i]
        team2 = teams[i+1]
        
        # Match aller
        score_aller1, score_aller2, conf1 = predict_match_ml(team1, team2, '2025-2026')
        
        # Match retour
        score_retour2, score_retour1, conf2 = predict_match_ml(team2, team1, '2025-2026')
        
        # Score total
        total1 = score_aller1 + score_retour1
        total2 = score_aller2 + score_retour2
        
        confidence_avg = (conf1 + conf2) / 2
        
        if total1 > total2:
            winner = team1
        elif total2 > total1:
            winner = team2
        else:
            # Tirs au but : équipe avec meilleur coefficient gagne
            team1_coef = ranking_all[ranking_all['equipe'] == team1]['TotalPoints'].max()
            team2_coef = ranking_all[ranking_all['equipe'] == team2]['TotalPoints'].max()
            winner = team1 if team1_coef > team2_coef else team2
        
        winners.append(winner)
        
        result = {
            'team1': team1,
            'team2': team2,
            'aller': f"{score_aller1}-{score_aller2}",
            'retour': f"{score_retour1}-{score_retour2}",
            'total': f"{total1}-{total2}",
            'winner': winner,
            'confidence': f"{confidence_avg:.1f}%"
        }
        results.append(result)
        
        print(f"   {team1:25} vs {team2:25}")
        print(f"   Aller: {score_aller1}-{score_aller2} | Retour: {score_retour1}-{score_retour2} | Total: {total1}-{total2}")
        print(f"    Qualifié: {winner} (Confiance: {confidence_avg:.1f}%)")
        print()
    
    return winners, results

def simulate_final_ml(team1, team2):
    """Simule la finale"""
    print(f"\n FINALE LDC 2025-2026")
    print("=" * 60)
    
    score1, score2, confidence = predict_match_ml(team1, team2, '2025-2026')
    
    if score1 > score2:
        winner = team1
    elif score2 > score1:
        winner = team2
    else:
        # Tirs au but : équipe avec meilleur coefficient
        team1_coef = ranking_all[ranking_all['equipe'] == team1]['TotalPoints'].max()
        team2_coef = ranking_all[ranking_all['equipe'] == team2]['TotalPoints'].max()
        winner = team1 if team1_coef > team2_coef else team2
    
    result = {
        'team1': team1,
        'team2': team2,
        'score': f"{score1}-{score2}",
        'winner': winner,
        'confidence': f"{confidence:.1f}%"
    }
    
    print(f"   {team1:25} vs {team2:25}")
    print(f"   Score: {score1}-{score2}")
    print(f"    CHAMPION: {winner}")
    print(f"   Confiance de la prédiction: {confidence:.1f}%")
    
    return result

# Simulation complète
np.random.shuffle(teams_2025)  # Tirage au sort

winners_16, results_16 = simulate_round_ml(teams_2025, " HUITIÈMES DE FINALE")
winners_8, results_8 = simulate_round_ml(winners_16, " QUARTS DE FINALE")
winners_4, results_4 = simulate_round_ml(winners_8, " DEMI-FINALES")
final_result = simulate_final_ml(winners_4[0], winners_4[1])

# ======================================
# 8. Résumé final
# ======================================
print("\n" + "=" * 60)
print(" RÉSUMÉ COMPLET LDC 2025-2026")
print("=" * 60)
print(f"\n CHAMPION: {final_result['winner']}")
print(f" Précision du modèle: {cv_scores.mean()*100:.2f}%")
print(f" Confiance finale: {final_result['confidence']}")
print("\n Simulation terminée avec succès!")


# ======================================
# 9. Export des rÃ©sultats (optionnel)
# ======================================
# Sauvegarder les rÃ©sultats dans un fichier JSON
import json

all_results = {
    'season': '2025-2026',
    'model_accuracy': f"{cv_scores.mean()*100:.2f}%",
    'champion': final_result['winner'],
    'huitiemes': results_16,
    'quarts': results_8,
    'demi_finales': results_4,
    'finale': final_result
}

with open('predictions_ldc_2025_2026.json', 'w', encoding='utf-8') as f:
    json.dump(all_results, f, ensure_ascii=False, indent=2)

print("Résultats sauvegardés dans 'predictions_ldc_2025_2026.json'")


# ======================================
# 9. Envoi des prédictions vers l'API
# ======================================
import requests

API_URL = "http://localhost:5000/api/predictions/upload"
TOKEN = "251ae5ccea0102f2942191a9150d56d7d750ec72658b2097bbd4d3a4f0e505b6efecea014b0648497e744f36d1751dc0f7fdf685598bb569836e104876b5246155de71040042ab02c5d18fc5cdcf99c233de1e71e0a2e706f11b525ff634d9c440d700033c556d76c5daf4c2ca3cad9957b7e949fa311ae0311807f7f6ebee2a"  # Créez un token admin dans votre BDD

# Préparer les données pour l'API
predictions_payload = {
    'season': '2025-2026',
    'predictions': []
}

# Huitièmes
for result in results_16:
    predictions_payload['predictions'].append({
        'phase': 'Huitièmes de finale',
        'team1': result['team1'],
        'team2': result['team2'],
        'match_aller': result['aller'],
        'match_retour': result['retour'],
        'score_total': result['total'],
        'winner': result['winner'],
        'confidence': result['confidence']
    })

# Quarts
for result in results_8:
    predictions_payload['predictions'].append({
        'phase': 'Quarts de finale',
        'team1': result['team1'],
        'team2': result['team2'],
        'match_aller': result['aller'],
        'match_retour': result['retour'],
        'score_total': result['total'],
        'winner': result['winner'],
        'confidence': result['confidence']
    })

# Demi-finales
for result in results_4:
    predictions_payload['predictions'].append({
        'phase': 'Demi-finales',
        'team1': result['team1'],
        'team2': result['team2'],
        'match_aller': result['aller'],
        'match_retour': result['retour'],
        'score_total': result['total'],
        'winner': result['winner'],
        'confidence': result['confidence']
    })

# Finale
predictions_payload['predictions'].append({
    'phase': 'Finale',
    'team1': final_result['team1'],
    'team2': final_result['team2'],
    'score': final_result['score'],
    'winner': final_result['winner'],
    'confidence': final_result['confidence']
})

from sqlalchemy import Table, Column, Integer, MetaData, TIMESTAMP
from sqlalchemy.dialects.mysql import VARCHAR
import datetime

metadata = MetaData()

predictions_table = Table('Predictions', metadata,
    Column('PredictionId', Integer, primary_key=True, autoincrement=True),
    Column('saison', VARCHAR(20), nullable=False),
    Column('phase', VARCHAR(50), nullable=False),
    Column('team1', VARCHAR(100), nullable=False),
    Column('team2', VARCHAR(100), nullable=False),
    Column('score_prediction', VARCHAR(10), nullable=False),
    Column('winner_prediction', VARCHAR(100), nullable=False),
    Column('confidence', VARCHAR(10), nullable=False),
    Column('match_aller', VARCHAR(10), nullable=False),
    Column('match_retour', VARCHAR(10), nullable=False),
    Column('created_at', TIMESTAMP, default=datetime.datetime.now, onupdate=datetime.datetime.now)
)

# ======================================
# 9. INSERTION DIRECTE DANS LA BDD (CORRIGÉ)
# ======================================
from sqlalchemy import text

print("\n💾 Insertion des prédictions dans la BDD...")

with engine.begin() as conn:  # .begin() fait un COMMIT automatique !
    # Supprimer anciennes prédictions
    conn.execute(text("DELETE FROM Predictions WHERE saison = '2025-2026'"))
    
    # HuitièmesTable de finale
    for p in results_16:
        conn.execute(text("""
            INSERT INTO Predictions 
            (saison, phase, team1, team2, score_prediction, winner_prediction, confidence, match_aller, match_retour)
            VALUES (:saison, :phase, :team1, :team2, :score, :winner, :confidence, :aller, :retour)
        """), {
            'saison': '2025-2026',
            'phase': 'Huitièmes de finale',
            'team1': p['team1'],
            'team2': p['team2'],
            'score': p['total'],
            'winner': p['winner'],
            'confidence': p['confidence'],
            'aller': p['aller'],
            'retour': p['retour']
        })
    
    # Quarts de finale
    for p in results_8:
        conn.execute(text("""
            INSERT INTO Predictions 
            (saison, phase, team1, team2, score_prediction, winner_prediction, confidence, match_aller, match_retour)
            VALUES (:saison, :phase, :team1, :team2, :score, :winner, :confidence, :aller, :retour)
        """), {
            'saison': '2025-2026',
            'phase': 'Quarts de finale',
            'team1': p['team1'],
            'team2': p['team2'],
            'score': p['total'],
            'winner': p['winner'],
            'confidence': p['confidence'],
            'aller': p['aller'],
            'retour': p['retour']
        })
    
    # Demi-finales
    for p in results_4:
        conn.execute(text("""
            INSERT INTO Predictions 
            (saison, phase, team1, team2, score_prediction, winner_prediction, confidence, match_aller, match_retour)
            VALUES (:saison, :phase, :team1, :team2, :score, :winner, :confidence, :aller, :retour)
        """), {
            'saison': '2025-2026',
            'phase': 'Demi-finales',
            'team1': p['team1'],
            'team2': p['team2'],
            'score': p['total'],
            'winner': p['winner'],
            'confidence': p['confidence'],
            'aller': p['aller'],
            'retour': p['retour']
        })
    
    # Finale
    conn.execute(text("""
        INSERT INTO Predictions 
        (saison, phase, team1, team2, score_prediction, winner_prediction, confidence, match_aller, match_retour)
        VALUES (:saison, :phase, :team1, :team2, :score, :winner, :confidence, '0-0', '0-0')
    """), {
        'saison': '2025-2026',
        'phase': 'Finale',
        'team1': final_result['team1'],
        'team2': final_result['team2'],
        'score': final_result['score'],
        'winner': final_result['winner'],
        'confidence': final_result['confidence']
    })

print("✅ Toutes les prédictions ont été enregistrées dans la BDD avec succès!")

# Vérification
with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) as total FROM Predictions WHERE saison = '2025-2026'"))
    count = result.fetchone()[0]
    print(f"✅ {count} prédictions vérifiées dans la BDD")