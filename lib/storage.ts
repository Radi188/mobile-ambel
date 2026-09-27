import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY  = '@ambel_token';
const BRANCH_KEY = '@ambel_branch_id';
const BASE_URL_KEY = '@ambel_base_url';

export const storage = {
  getToken:    () => AsyncStorage.getItem(TOKEN_KEY),
  setToken:    (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  removeToken: () => AsyncStorage.removeItem(TOKEN_KEY),

  getBranchId:    () => AsyncStorage.getItem(BRANCH_KEY),
  setBranchId:    (id: string) => AsyncStorage.setItem(BRANCH_KEY, id),
  removeBranchId: () => AsyncStorage.removeItem(BRANCH_KEY),

  getBaseUrl:    () => AsyncStorage.getItem(BASE_URL_KEY),
  setBaseUrl:    (url: string) => AsyncStorage.setItem(BASE_URL_KEY, url),
  removeBaseUrl: () => AsyncStorage.removeItem(BASE_URL_KEY),
};
