import React, { useState, useEffect } from 'react';
import { db } from "./firebase"; 
import { doc, getDoc, setDoc } from "firebase/firestore";

// यहाँ तपाईँको अरू Import हरू (Components, Types) राख्नुहोस्
// उदाहरण: import { AppState, Party, Bill } from './types';

function App() {
  const [state, setState] = useState<any>(null); // आफ्नो AppState टाइप यहाँ राख्नुहोस्
  const [gatewayUser, setGatewayUser] = useState<any>(null);

  // १. क्लाउडबाट डेटा लोड गर्ने (Line 96-116 मा भएको समस्या समाधान)
  useEffect(() => {
    const loadDataFromCloud = async () => {
      if (gatewayUser) {
        // सेसनलाई सुरक्षित राख्ने
        localStorage.setItem('accountaid_gateway_session', JSON.stringify(gatewayUser));
        
        const storageKey = `state_${gatewayUser.email}`;
        const docRef = doc(db, "user_states", storageKey);
        
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setState(docSnap.data());
          } else {
            // यदि नयाँ युजर हो भने खाली स्टेट दिने
            // setState(getInitialState()); 
          }
        } catch (error) {
          console.error("Cloud बाट डेटा तान्दा समस्या आयो:", error);
        }
      }
    };
    loadDataFromCloud();
  }, [gatewayUser]);

  // २. क्लाउडमा डेटा सेभ गर्ने (Line 60-80 मा भएको समस्या समाधान)
  useEffect(() => {
    const saveDataToCloud = async () => {
      if (gatewayUser && state?.hasUnsavedChanges) {
        const storageKey = `state_${gatewayUser.email}`;
        const docRef = doc(db, "user_states", storageKey);
        
        try {
          await setDoc(docRef, {
            ...state,
            hasUnsavedChanges: false,
            lastSync: new Date().toISOString()
          });
          console.log("Cloud sync successful!");
        } catch (error) {
          console.error("Cloud मा सेभ गर्दा समस्या आयो:", error);
        }
      }
    };
    saveDataToCloud();
  }, [state, gatewayUser]);

  // यहाँ तपाईँको बाँकी सफ्टवेयरको Logic र UI (Return block) राख्नुहोस्
  return (
    <div>
      {/* तपाईँको एपको मुख्य भाग यहाँ हुन्छ */}
      <h1>AccountAid Pro Cloud</h1>
    </div>
  );
}

export default App;
