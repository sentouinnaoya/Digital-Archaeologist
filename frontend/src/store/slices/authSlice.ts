import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse } from '@/lib/types';

interface AuthState {
  user: AuthResponse['user'] | null;
  accessToken: string | null;
  hydrated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<AuthResponse | null>) {
      state.user = action.payload?.user ?? null;
      state.accessToken = action.payload?.accessToken ?? null;
      state.hydrated = true;
    },
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.hydrated = true;
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.hydrated = true;
    },
  },
});

export const { hydrate, setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
