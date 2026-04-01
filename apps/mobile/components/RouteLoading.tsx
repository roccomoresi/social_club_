import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function RouteLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
