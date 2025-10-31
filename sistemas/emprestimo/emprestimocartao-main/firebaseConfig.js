// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC-IlMNSPg4MmDDFqUSGAAO_dL_absBDLo",
    authDomain: "cartoes-88211.firebaseapp.com",
    projectId: "cartoes-88211",
    storageBucket: "cartoes-88211.appspot.com",
    messagingSenderId: "314683342095",
    appId: "1:314683342095:web:7625eef34a666bc7c2127a",
    measurementId: "G-XB902LGX5S"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Firestore
const db = firebase.firestore();

// Storage (apenas se necessário)
let storage;
if (typeof firebase.storage === "function") {
    storage = firebase.storage();
} else {
    console.warn("Firebase Storage não carregado. Apenas Firestore disponível.");
}
