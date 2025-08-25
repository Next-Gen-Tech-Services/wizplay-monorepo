export type TOPIC_TYPE = string;

export interface MessageType {
  headers?: Record<string, any>;
  event: string;
  data: Record<string, any>;
}

export interface PublishType {
  headers?: Record<string, any>;
  topic: TOPIC_TYPE;
  event: string;
  message: Record<string, any>;
}

export type MessageHandler = (message: MessageType) => void;

export type MessageBrokerType = {
  connectProducer: () => Promise<any>;
  disconnectProducer: () => Promise<void>;
  publish: (data: PublishType) => Promise<boolean>;
  connectConsumer: () => Promise<any>;
  disconnectConsumer: () => Promise<void>;
  subscribe: (handler: MessageHandler, topic: TOPIC_TYPE) => Promise<void>;
};
