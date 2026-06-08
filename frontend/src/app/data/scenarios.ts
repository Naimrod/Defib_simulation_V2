export interface Scenario {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  color: "red" | "orange" | "purple" | "green";
  icon: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "scenario_1",
    title: "Scénario 1 - ACR défibrillation en mode manuel ",
    description:
      "Un homme de 62 ans pris en charge aux urgences pour une douleur thoracique est retrouvé en arrêt cardio respiratoire. La réanimation cardio pulmonaire est débutée, les électrodes de défibrillation sont posées sur le torse du patient.\n\nObjectif :\nUtiliser le défibrillateur en mode manuel pour délivrer un choc de 150 Joules.",
    objectives: [
      "Connecter les électrodes et vérifier le bon positionnement sur le torse",
      "Allumer le défibrillateur en position moniteur",
      "Lire le rythme et arrêter le massage pour analyser le rythme (FV)",
      "Positionner la molette verte sur 150 joules",
      "Appuyer sur le bouton jaune pour charger",
      "Délivrer le choc en appuyant sur le bouton orange",
    ],
    color: "red",
    icon: "⚡",
  },
  {
    id: "scenario_2",
    title: "Scénario 2 - ACR défibrillation en mode DAE ",
    description:
      "Un homme de 58 ans est hospitalisé aux urgences pour une embolie pulmonaire. L'infirmière le découvre en arrêt cardio respiratoire et amène le chariot d'urgence après avoir donné l’alerte.\n\nObjectif:\nUtiliser le défibrillateur en mode DAE pour mener à bien la réanimation cardio pulmonaire.",
    objectives: [
      "Allumer le défibrillateur en mode DAE",
      "Connecter le connecteur et brancher les électrodes sur la poitrine du patient",
      "Délivrer le choc en appuyant sur le bouton orange",
    ],
    color: "orange",
    icon: "💓",
  },
  {
    id: "scenario_3",
    title: "Scénario 3 - Entraînement électrosystolique",
    description:
      "Une femme de 65 ans présente une bradycardie aux urgences, son ECG est interprété : BAV III à 30 bpm. Le traitement médicamenteux est inefficace et la patiente présente des signes de mauvaise tolérance hémodynamique. Un entraînement électro systolique externe sous sédation est décidé. Les électrodes d’enregistrement ainsi que les électrodes de stimulation sont posées sur la poitrine de la patiente.\n\nObjectif:\nUtiliser le stimulateur en mode sentinelle pour délivrer un courant à la fréquence de 60 bpm avec une intensité croissante en partant de 10mA jusqu’à obtenir une capture.",
    objectives: [
      "Positionner la molette verte sur stimulation",
      "Choisir le mode sentinelle",
      "Régler la fréquence de l'électro-entraînement à 60/min",
      "Démarrer la stimulation",
      "Régler l'intensité de l'électro-entraînement progressivement de manière a obtenir une capture du signal ECG (de 10mA en 10mA à partir de 10mA). La capture sera obtenue à partir de 90 mA",
      "Lancer la séquence de stimulation en mode fixe",
    ],
    color: "purple",
    icon: "💔",
  },
  {
    id: "scenario_4",
    title: "Scénario 4 - Cardioversion",
    description:
      "Un homme de 80 ans est pris en charge aux urgences pour une syncope associée à des palpitations apparues depuis moins de 24h. L'ECG est interprété : ACFA à 200 bpm, le traitement médicamenteux est un échec et le patient présente une hypotension artérielle. Une cardioversion électrique sous sédation est décidée. Les électrodes de défibrillation sont posées sur la poitrine du patient.\n\nObjectif:\nUtiliser le défibrillateur pour réaliser une cardioversion électrique a 150 joules.",
    objectives: [
      "Allumer le défibrillateur",
      "Positionnez la molette sur 150 Joules",
      "Appuyer sur le bouton synchro",
      "Appuyer sur le bouton jaune pour charger",
      "Délivrer le choc en appuyant sur le bouton orange",
    ],
    color: 'green',
    icon: '💚'
  },
  {
    id: 'scenario_5',
    title: 'Scénario 5 - Simulation in situ',
    description: 'Ce scénario peut être réalisé avec votre équipe de simulation. Vous prenez en charge un patient retrouvé en arrêt cardio respiratoire.\n\nObjectif:\nUtiliser le défibrillateur pour mener à bien la réanimation cardiopulmonaire.\n\nN.B. : L’application n’étant pas connectée à votre mannequin, vous devez cliquer sur la fenêtre ou s’affiche la FC après avoir posé vos électrodes de défibrillation pour révéler le rythme, vous ne verrez pas l’activité électrique de votre massage cardiaque lors de la RCP.',
    objectives: [
      
    ],
    color: 'orange',
    icon: '🚑'
  }
];

export const COLOR_CLASSES = {
  red: "border-red-500 hover:bg-red-900/20",
  orange: "border-orange-500 hover:bg-orange-900/20",
  purple: "border-purple-500 hover:bg-purple-900/20",
  green: "border-green-500 hover:bg-green-900/20",
};
