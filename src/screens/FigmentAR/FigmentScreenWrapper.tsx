import React, { Component } from 'react';
// @ts-ignore
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
// @ts-ignore
import App from './app';
// @ts-ignore
import reducers from './redux/reducers';
import { View, StyleSheet } from 'react-native';

const store = createStore(reducers);

import { SafeAreaView } from 'react-native-safe-area-context';

export default class FigmentScreenWrapper extends Component {
    render() {
        return (
            <SafeAreaView style={{ flex: 1 }} edges={['right', 'left']}>
                <View style={{ flex: 1 }}>
                    <Provider store={store}>
                        <App {...this.props} />
                    </Provider>
                </View>
            </SafeAreaView>
        )
    }
}
