import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from "redux-persist"
import storage from "redux-persist/lib/storage"
import { rootReducer } from './rootReducer';
import { thunk } from "redux-thunk";
import { writeSsrLocationCookie } from '@/utils/ssrLocationCookie';

const persistConfig = {
    key: 'root',
    storage,
};


const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false,
        applyMiddleware: thunk
    })
});
export const persistor = persistStore(store);

// Mirror the active city's coordinates into a cookie so the next server render
// seeds from the SAME location the client will use after hydration — otherwise
// every coordinate-keyed query refetches on hydration. See ssrLocationCookie.ts.
let lastMirroredLocation: string | null = null;
store.subscribe(() => {
    const city = (store.getState() as any)?.City?.city;
    if (!city?.latitude || !city?.longitude) return;
    const next = `${city.latitude},${city.longitude}`;
    if (next === lastMirroredLocation) return;
    lastMirroredLocation = next;
    writeSsrLocationCookie(city.latitude, city.longitude);
});
