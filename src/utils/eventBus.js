// 事件总线，用于在Vuex和组件之间传递消息
import mitt from 'mitt';

const eventBus = mitt();

export default eventBus;
