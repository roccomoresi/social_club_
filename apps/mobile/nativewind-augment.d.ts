import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
    tw?: string;
  }
  interface TextProps {
    className?: string;
    tw?: string;
  }
  interface ImagePropsBase {
    className?: string;
    tw?: string;
  }
  interface PressableProps {
    className?: string;
    tw?: string;
  }
  interface TextInputProps {
    className?: string;
    tw?: string;
  }
  interface ScrollViewProps {
    className?: string;
    tw?: string;
  }
  interface KeyboardAvoidingViewProps {
    className?: string;
    tw?: string;
  }
}

declare module 'react-native-safe-area-context' {
  interface NativeSafeAreaViewProps {
    className?: string;
    tw?: string;
  }
}
