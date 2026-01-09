import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ERPComm/models/channel.dart';
import 'package:ERPComm/models/profile.dart';

class SelectedNavigation {
  final Channel? channel;
  final Profile? recipient;

  SelectedNavigation({this.channel, this.recipient});

  SelectedNavigation copyWith({Channel? channel, Profile? recipient}) {
    return SelectedNavigation(
      channel: channel ?? (recipient != null ? null : this.channel),
      recipient: recipient ?? (channel != null ? null : this.recipient),
    );
  }
}

class NavigationNotifier extends StateNotifier<SelectedNavigation> {
  NavigationNotifier() : super(SelectedNavigation());

  void selectChannel(Channel channel) {
    state = SelectedNavigation(channel: channel);
  }

  void selectDM(Profile recipient) {
    state = SelectedNavigation(recipient: recipient);
  }
}

final navigationProvider = StateNotifierProvider<NavigationNotifier, SelectedNavigation>((ref) {
  return NavigationNotifier();
});
